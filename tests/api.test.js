import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, it, beforeEach } from 'node:test';

import { getBookingWindow, getUnavailableDates } from '../api/_lib/availability.js';
import { getConfig } from '../api/_lib/config.js';
import { addDays, busyDates, isIsoDate, startOfLocalDay } from '../api/_lib/dates.js';
import { clearTokenCache, queryBusy, signJwt } from '../api/_lib/google.js';
import { validateBooking } from '../api/_lib/validation.js';
import { buildBookingMessage, buildWhatsAppUrl } from '../api/_lib/whatsapp.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const config = getConfig({
  WHATSAPP_NUMBER: '+234 813 607 8551',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@test.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: PEM.replace(/\n/g, '\\n'), // as pasted into an env var
  GOOGLE_CALENDAR_ID: 'dreas@example.com',
});

// Fake Google: answers token and freeBusy requests and records them.
function fakeGoogle(busy, { calendarErrors } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url === config.google.tokenUrl) {
      return Response.json({ access_token: 'tok', expires_in: 3600 });
    }
    const body = JSON.parse(init.body);
    const inRange = busy.filter((b) => b.end > body.timeMin && b.start < body.timeMax);
    const calendar = calendarErrors ? { errors: calendarErrors } : { busy: inRange };
    return Response.json({ calendars: { [config.google.calendarId]: calendar } });
  };
  return { calls, fetchImpl };
}

describe('config', () => {
  it('normalises the WhatsApp number and private key', () => {
    assert.equal(config.whatsappNumber, '2348136078551');
    assert.ok(config.google.privateKey.includes('\n-----END PRIVATE KEY-----'));
  });
});

describe('dates', () => {
  it('validates real calendar dates only', () => {
    assert.ok(isIsoDate('2026-02-28'));
    assert.ok(!isIsoDate('2026-02-30'));
    assert.ok(!isIsoDate('2026-2-3'));
  });

  it('finds local midnight in Lagos (UTC+1)', () => {
    assert.equal(startOfLocalDay('2026-12-05', 'Africa/Lagos').toISOString(), '2026-12-04T23:00:00.000Z');
  });

  it('maps busy periods to Lagos days', () => {
    const days = busyDates(
      [
        // 23:30 UTC on the 4th is 00:30 on the 5th in Lagos.
        { start: '2026-12-04T23:30:00Z', end: '2026-12-05T02:00:00Z' },
        // An all-day event on the 10th ends exactly at local midnight and must not book the 11th.
        { start: '2026-12-09T23:00:00Z', end: '2026-12-10T23:00:00Z' },
        // Overnight shoot across two days.
        { start: '2026-12-20T20:00:00Z', end: '2026-12-21T03:00:00Z' },
      ],
      'Africa/Lagos',
    );
    assert.deepEqual([...days].sort(), ['2026-12-05', '2026-12-10', '2026-12-20', '2026-12-21']);
  });
});

describe('google client', () => {
  beforeEach(() => clearTokenCache());

  it('signs a JWT Google can verify', () => {
    const jwt = signJwt(config.google, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url'));
    assert.equal(claims.iss, 'sa@test.iam.gserviceaccount.com');
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/calendar.freebusy');
    assert.equal(claims.exp - claims.iat, 3600);
    const ok = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'));
    assert.ok(ok);
  });

  it('reuses the access token between queries', async () => {
    const g = fakeGoogle([]);
    await queryBusy(config.google, '2026-12-01T00:00:00Z', '2026-12-02T00:00:00Z', g);
    await queryBusy(config.google, '2026-12-01T00:00:00Z', '2026-12-02T00:00:00Z', g);
    assert.equal(g.calls.filter((c) => c.url === config.google.tokenUrl).length, 1);
  });

  it('reports a calendar that was not shared with the service account', async () => {
    const g = fakeGoogle([], { calendarErrors: [{ domain: 'global', reason: 'notFound' }] });
    await assert.rejects(queryBusy(config.google, 'a', 'b', g), /notFound/);
  });
});

describe('availability', () => {
  beforeEach(() => clearTokenCache());

  it('computes the booking window from today in Lagos', () => {
    // 23:30 UTC on 20 Nov is already 21 Nov in Lagos.
    const w = getBookingWindow(config, new Date('2026-11-20T23:30:00Z'));
    assert.equal(w.today, '2026-11-21');
    assert.equal(w.firstBookable, '2026-11-23');
    assert.equal(w.lastBookable, addDays('2026-11-21', 180));
  });

  it('splits long ranges into 60-day queries and merges the results', async () => {
    const g = fakeGoogle([
      { start: '2026-12-05T09:00:00Z', end: '2026-12-05T17:00:00Z' },
      { start: '2027-03-14T09:00:00Z', end: '2027-03-14T12:00:00Z' },
      { start: '2027-09-01T09:00:00Z', end: '2027-09-01T12:00:00Z' }, // outside the range
    ]);
    const days = await getUnavailableDates(config, '2026-11-23', '2027-05-20', g);
    assert.deepEqual(days, ['2026-12-05', '2027-03-14']);
    assert.equal(g.calls.filter((c) => c.url.endsWith('/freeBusy')).length, 3);
  });
});

describe('validation', () => {
  const window = { maxDates: 3, firstBookable: '2026-11-23', lastBookable: '2027-05-20' };
  const valid = {
    name: '  Ada   Obi ',
    phone: '+234 801 234 5678',
    email: '',
    eventType: 'Wedding',
    service: 'Photo + Video',
    dates: ['2026-12-12', '2026-12-11'],
    startTime: '14:00',
    location: 'Awka',
    budget: '',
    details: 'Church then reception.\n\n\n\nAbout 300 guests.',
    website: '',
  };

  it('accepts and cleans a valid booking', () => {
    const r = validateBooking(valid, window);
    assert.ok(r.ok);
    assert.equal(r.value.name, 'Ada Obi');
    assert.deepEqual(r.value.dates, ['2026-12-11', '2026-12-12']);
    assert.equal(r.value.details, 'Church then reception.\n\nAbout 300 guests.');
  });

  it('reports each bad field', () => {
    const r = validateBooking(
      { ...valid, name: 'A', phone: '123', email: 'nope', eventType: 'Rave', dates: ['2026-11-20'], location: '' },
      window,
    );
    assert.ok(!r.ok);
    assert.deepEqual(Object.keys(r.fields).sort(), ['dates', 'email', 'eventType', 'location', 'name', 'phone']);
  });

  it('rejects duplicate, too many and invalid dates', () => {
    assert.ok(validateBooking({ ...valid, dates: ['2026-12-11', '2026-12-11'] }, window).fields.dates);
    assert.ok(validateBooking({ ...valid, dates: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'] }, window).fields.dates);
    assert.ok(validateBooking({ ...valid, dates: ['2026-12-32'] }, window).fields.dates);
  });

  it('rejects the honeypot and non-object bodies', () => {
    assert.ok(!validateBooking({ ...valid, website: 'spam.com' }, window).ok);
    assert.ok(!validateBooking(null, window).ok);
    assert.ok(!validateBooking([], window).ok);
  });
});

describe('whatsapp', () => {
  it('builds the message and an encoded wa.me link', () => {
    const msg = buildBookingMessage({
      name: 'Ada Obi',
      phone: '+234 801 234 5678',
      email: '',
      eventType: 'Wedding',
      service: 'Photo + Video',
      dates: ['2026-12-11', '2026-12-12'],
      startTime: '',
      location: 'Awka',
      budget: '',
      details: '',
    });
    assert.match(msg, /\*Dates:\* Fri, 11 Dec 2026 · Sat, 12 Dec 2026/);
    assert.doesNotMatch(msg, /Email|Start time|Budget|Details/);
    const url = buildWhatsAppUrl('2348136078551', msg);
    assert.ok(url.startsWith('https://wa.me/2348136078551?text=Hello%20Dreas'));
    assert.equal(decodeURIComponent(url.split('text=')[1]), msg);
  });
});
