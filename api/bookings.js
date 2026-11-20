// POST /api/bookings
// Validates a booking, re-checks the dates against the calendar, and returns the
// WhatsApp click-to-chat link with the details pre-filled. Nothing is stored.

import { getBookingWindow, getUnavailableDates } from './_lib/availability.js';
import { getConfig, isCalendarConfigured } from './_lib/config.js';
import { HttpError, allowMethods, readJson, sendError, sendJson } from './_lib/http.js';
import { validateBooking } from './_lib/validation.js';
import { buildBookingMessage, buildWhatsAppUrl } from './_lib/whatsapp.js';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    if (err instanceof HttpError) return sendError(res, err.status, err.code, err.message);
    throw err;
  }

  const config = getConfig();
  if (!config.whatsappNumber) {
    console.error('[bookings] WHATSAPP_NUMBER is not set');
    return sendError(res, 503, 'BOOKING_NOT_CONFIGURED', 'Online booking is not set up yet.');
  }

  const window = getBookingWindow(config);
  const result = validateBooking(body, window);
  if (!result.ok) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields: result.fields });
  }
  const booking = result.value;

  // Re-check here because the calendar may have changed since the page loaded.
  // If Google is down, still let the client send the request. Dreas confirms on WhatsApp anyway.
  let availabilityChecked = false;
  if (isCalendarConfigured(config)) {
    try {
      const { dates } = booking;
      const unavailable = new Set(await getUnavailableDates(config, dates[0], dates[dates.length - 1]));
      const taken = dates.filter((d) => unavailable.has(d));
      if (taken.length > 0) {
        return sendError(res, 409, 'DATES_UNAVAILABLE', 'Some of these dates were just booked.', { dates: taken });
      }
      availabilityChecked = true;
    } catch (err) {
      console.error('[bookings] availability re-check failed:', err.code ?? 'ERROR', err.message);
    }
  }

  const message = buildBookingMessage(booking);
  sendJson(
    res,
    200,
    { whatsappUrl: buildWhatsAppUrl(config.whatsappNumber, message), message, availabilityChecked },
    { 'Cache-Control': 'no-store' },
  );
}
