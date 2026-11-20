// GET /api/booking-options
// The event types and services the booking form offers (edit them in _lib/options.js).

import { getConfig } from './_lib/config.js';
import { allowMethods, sendJson } from './_lib/http.js';
import { EVENT_TYPES, SERVICES } from './_lib/options.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  sendJson(
    res,
    200,
    { eventTypes: EVENT_TYPES, services: SERVICES, maxDates: getConfig().maxDates },
    { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  );
}
