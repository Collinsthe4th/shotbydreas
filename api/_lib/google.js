// Minimal Google Calendar client: service-account auth + freeBusy query.
// Uses only Node built-ins (fetch, crypto), so the API has no npm dependencies.

import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';

export class UpstreamError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UpstreamError';
    this.code = code;
  }
}

const b64url = (input) => Buffer.from(input).toString('base64url');

export function signJwt({ clientEmail, privateKey, tokenUrl }, nowSeconds) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: tokenUrl,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(privateKey);
  return `${header}.${claims}.${b64url(signature)}`;
}

// Tokens last an hour. Warm serverless instances reuse them.
let cachedToken = null;

export function clearTokenCache() {
  cachedToken = null;
}

export async function getAccessToken(google, { fetchImpl = fetch, now = Date.now } = {}) {
  const nowMs = now();
  if (cachedToken && cachedToken.email === google.clientEmail && cachedToken.expiresAt - 60_000 > nowMs) {
    return cachedToken.token;
  }

  let assertion;
  try {
    assertion = signJwt(google, Math.floor(nowMs / 1000));
  } catch {
    throw new UpstreamError('GOOGLE_KEY_INVALID', 'GOOGLE_PRIVATE_KEY could not be used to sign a token.');
  }

  const res = await fetchImpl(google.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new UpstreamError('GOOGLE_AUTH_FAILED', `Token request failed (${res.status}): ${data.error ?? 'unknown'}`);
  }

  cachedToken = {
    email: google.clientEmail,
    token: data.access_token,
    expiresAt: nowMs + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

// Returns the busy periods [{ start, end }] for the calendar between two instants.
export async function queryBusy(google, timeMin, timeMax, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const token = await getAccessToken(google, deps);

  const res = await fetchImpl(`${google.apiBase}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: google.calendarId }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearTokenCache();
    throw new UpstreamError('GOOGLE_FREEBUSY_FAILED', `freeBusy failed (${res.status}): ${data.error?.message ?? 'unknown'}`);
  }

  const calendar = data.calendars?.[google.calendarId];
  if (!calendar) {
    throw new UpstreamError('GOOGLE_CALENDAR_MISSING', 'freeBusy response did not include the calendar.');
  }
  if (calendar.errors?.length) {
    // "notFound" almost always means the calendar has not been shared with the service account.
    const reason = calendar.errors[0].reason ?? 'unknown';
    throw new UpstreamError('GOOGLE_CALENDAR_ERROR', `Calendar error: ${reason}`);
  }
  return calendar.busy ?? [];
}
