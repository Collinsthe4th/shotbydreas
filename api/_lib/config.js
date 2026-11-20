// Reads all booking settings from environment variables.
// Read lazily (per request) so tests and the dev server can change them.

const toInt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function getConfig(env = process.env) {
  return {
    timeZone: env.BOOKING_TIMEZONE || 'Africa/Lagos',
    // How far ahead clients can book, in days.
    windowDays: toInt(env.BOOKING_WINDOW_DAYS, 180),
    // Days of notice required: 2 means the earliest bookable day is the day after tomorrow.
    minNoticeDays: toInt(env.BOOKING_MIN_NOTICE_DAYS, 2),
    // Most dates a client can pick in one request (multi-day events).
    maxDates: Math.max(1, toInt(env.BOOKING_MAX_DATES, 5)),
    // International format, digits only (e.g. 2348136078551). Used for the wa.me link.
    whatsappNumber: (env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
    // Free option (no Google Cloud Console): Apps Script web app in Dreas's account.
    script: {
      url: env.CALENDAR_SCRIPT_URL || '',
      key: env.CALENDAR_SCRIPT_KEY || '',
    },
    // Alternative: Google Cloud service account.
    google: {
      clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      // Vercel stores multi-line values fine, but pasted keys often arrive with literal "\n".
      privateKey: (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      calendarId: env.GOOGLE_CALENDAR_ID || '',
      // Overridable only so the local end-to-end test can point at a fake Google server.
      tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
      apiBase: env.GOOGLE_API_BASE || 'https://www.googleapis.com/calendar/v3',
    },
  };
}

export function usesAppsScript(config) {
  return Boolean(config.script.url && config.script.key);
}

export function isCalendarConfigured(config) {
  const { clientEmail, privateKey, calendarId } = config.google;
  return usesAppsScript(config) || Boolean(clientEmail && privateKey && calendarId);
}
