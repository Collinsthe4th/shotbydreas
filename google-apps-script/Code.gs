/**
 * SHOTBYDREAS availability feed (Google Apps Script, free, no Cloud Console needed).
 *
 * Runs inside Dreas's own Google account and returns only the busy time ranges of his
 * calendar (no event names or details). The website calls it with a secret key.
 *
 * Setup (once, from Dreas's Google account):
 *   1. Go to https://script.google.com/create and paste this whole file in place of the sample code.
 *   2. Change SECRET_KEY below to a long random string (keep a copy for Vercel).
 *   3. In the left panel, click "Services" (+), choose "Google Calendar API" and click Add.
 *   4. Click Deploy > New deployment > type "Web app".
 *        Execute as: Me    Who has access: Anyone
 *      Click Deploy, allow the permissions, and copy the Web app URL (ends with /exec).
 *   5. In Vercel, set CALENDAR_SCRIPT_URL to that URL and CALENDAR_SCRIPT_KEY to SECRET_KEY.
 *
 * If you edit this file later, use Deploy > Manage deployments > Edit > Version: New version,
 * so the URL stays the same.
 */

const SECRET_KEY = 'CHANGE-ME-to-a-long-random-string';

// 'primary' is the main calendar of the account running the script.
const CALENDAR_ID = 'primary';

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

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
