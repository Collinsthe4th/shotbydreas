/**
 * SHOTBYDREAS website helper (Google Apps Script, free, no Cloud Console needed).
 *
 * Runs inside Dreas's own Google account and does two jobs for the website:
 *   - GET:  returns only the busy time ranges of his calendar (no event names or details).
 *   - POST: emails messages from the contact form to his Gmail inbox.
 * The website calls it with a secret key.
 *
 * Setup (once, from Dreas's Google account):
 *   1. Go to https://script.google.com/create and paste this whole file in place of the sample code.
 *   2. Change SECRET_KEY below to a long random string (keep a copy for Vercel).
 *   3. In the left panel, click "Services" (+), choose "Google Calendar API" and click Add.
 *   4. Click Deploy > New deployment > type "Web app".
 *        Execute as: Me    Who has access: Anyone
 *      Click Deploy, allow the permissions (Calendar and "Send email as you"),
 *      and copy the Web app URL (ends with /exec).
 *   5. In Vercel, set CALENDAR_SCRIPT_URL to that URL and CALENDAR_SCRIPT_KEY to SECRET_KEY.
 *
 * If you edit this file later, use Deploy > Manage deployments > Edit > Version: New version,
 * so the URL stays the same. Google asks for the permissions again when a new version
 * needs one (for example the first time the contact form is added).
 */

const SECRET_KEY = 'CHANGE-ME-to-a-long-random-string';

// 'primary' is the main calendar of the account running the script.
const CALENDAR_ID = 'primary';

// Where contact form messages go. Leave empty to use the Gmail address of this account.
const CONTACT_TO = '';
// Stop a flood of messages if someone abuses the form (Gmail allows about 100 a day).
const MAX_MESSAGES_PER_HOUR = 20;

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (SECRET_KEY.indexOf('CHANGE-ME') === 0 || params.key !== SECRET_KEY) {
    return json_({ error: 'unauthorized' });
  }

  const timeMin = new Date(params.timeMin);
  const timeMax = new Date(params.timeMax);
  if (isNaN(timeMin) || isNaN(timeMax) || timeMax <= timeMin) {
    return json_({ error: 'invalid_range' });
  }
  // Keep each request to about 3 months (the website asks in 60-day chunks).
  if (timeMax - timeMin > 93 * 24 * 60 * 60 * 1000) {
    return json_({ error: 'range_too_long' });
  }

  try {
    const result = Calendar.Freebusy.query({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: CALENDAR_ID }],
    });
    const calendars = result.calendars || {};
    const calendar = calendars[CALENDAR_ID] || calendars[Object.keys(calendars)[0]] || {};
    if (calendar.errors && calendar.errors.length) {
      return json_({ error: 'calendar_error', reason: calendar.errors[0].reason });
    }
    return json_({ busy: calendar.busy || [] });
  } catch (err) {
    return json_({ error: 'calendar_error', reason: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ error: 'invalid_json' });
  }
  if (SECRET_KEY.indexOf('CHANGE-ME') === 0 || data.key !== SECRET_KEY) {
    return json_({ error: 'unauthorized' });
  }
  if (data.action !== 'contact') return json_({ error: 'unknown_action' });

  const clean = function (value, max) {
    return String(value || '').trim().slice(0, max);
  };
  const name = clean(data.name, 80);
  const email = clean(data.email, 120);
  const subject = clean(data.subject, 120);
  const message = clean(data.message, 2000);
  if (name.length < 2 || message.length < 5) return json_({ error: 'invalid_message' });

  // Simple hourly limit shared by every visitor.
  const cache = CacheService.getScriptCache();
  const slot = 'contact-' + Math.floor(Date.now() / 3600000);
  const count = Number(cache.get(slot) || 0);
  if (count >= MAX_MESSAGES_PER_HOUR) return json_({ error: 'rate_limited' });
  cache.put(slot, String(count + 1), 3600);

  const lines = [
    'New message from the SHOTBYDREAS website',
    '',
    'Name: ' + name,
    'Email: ' + (email || 'not given'),
    'Subject: ' + (subject || 'not given'),
    '',
    message,
  ];
  const mail = {
    to: CONTACT_TO || Session.getEffectiveUser().getEmail(),
    subject: 'Website message' + (subject ? ': ' + subject : ' from ' + name),
    body: lines.join('\n'),
    name: 'SHOTBYDREAS website',
  };
  // "Reply" in Gmail goes straight to the visitor when they left an email.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) mail.replyTo = email;

  try {
    MailApp.sendEmail(mail);
    return json_({ ok: true });
  } catch (err) {
    return json_({ error: 'mail_error', reason: String(err && err.message ? err.message : err) });
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
