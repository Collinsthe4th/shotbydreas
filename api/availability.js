// GET /api/availability
// Returns the booking window and the days already booked on Dreas's Google Calendar.

import { getBookingWindow, getUnavailableDates } from './_lib/availability.js';
import { getConfig, isCalendarConfigured } from './_lib/config.js';
import { allowMethods, sendError, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;

  const config = getConfig();
  const window = getBookingWindow(config);

  // Both failure responses still include the window, so the form can fall back to
  // "pick any date and Dreas will confirm".
  if (!isCalendarConfigured(config)) {
    sendError(res, 503, 'CALENDAR_NOT_CONFIGURED', 'Live availability is not set up yet.', { window });
    return;
  }

  try {
    const unavailable = await getUnavailableDates(config, window.firstBookable, window.lastBookable);
    sendJson(
      res,
      200,
      { ...window, unavailable, checkedAt: new Date().toISOString() },
      // Vercel's CDN caches this for 2 minutes, so calendar changes show up within a few minutes.
      { 'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=300' },
    );
  } catch (err) {
    console.error('[availability]', err.code ?? 'ERROR', err.message);
    sendError(res, 502, 'CALENDAR_UNAVAILABLE', 'We could not load availability right now.', { window });
  }
}
