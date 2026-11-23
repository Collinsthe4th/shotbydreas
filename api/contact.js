// POST /api/contact
// Validates a contact form message and emails it to Dreas's Gmail through the Apps Script
// web app. Nothing is stored on the website.

import { sendContactViaScript, validateContact } from './_lib/contact.js';
import { getConfig, usesAppsScript } from './_lib/config.js';
import { HttpError, allowMethods, readJson, sendError, sendJson } from './_lib/http.js';

// Best-effort limit per visitor (per server instance): 5 messages every 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

function tooMany(ip, now = Date.now()) {
  const times = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.size > 5000) recent.clear();
  if (times.length >= MAX_PER_WINDOW) {
    recent.set(ip, times);
    return true;
  }
  times.push(now);
  recent.set(ip, times);
  return false;
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    if (err instanceof HttpError) return sendError(res, err.status, err.code, err.message);
    throw err;
  }

  const result = validateContact(body);
  if (!result.ok) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields: result.fields });
  }
  // Pretend a bot's message went through so it does not try again.
  if (result.isBot) return sendJson(res, 200, { sent: true }, { 'Cache-Control': 'no-store' });

  const config = getConfig();
  if (!usesAppsScript(config)) {
    console.error('[contact] CALENDAR_SCRIPT_URL / CALENDAR_SCRIPT_KEY are not set');
    return sendError(res, 503, 'CONTACT_NOT_CONFIGURED', 'The contact form is not set up yet. Please message us on WhatsApp.');
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (tooMany(ip)) {
    return sendError(res, 429, 'TOO_MANY_MESSAGES', 'You have sent a few messages already. Please try again in a few minutes.');
  }

  try {
    await sendContactViaScript(config.script, result.value);
  } catch (err) {
    console.error('[contact] sending failed:', err.code ?? 'ERROR', err.message);
    const busy = err.reason === 'rate_limited';
    return sendError(
      res,
      busy ? 429 : 502,
      busy ? 'TOO_MANY_MESSAGES' : 'SEND_FAILED',
      busy
        ? 'We are getting a lot of messages right now. Please try again later or message us on WhatsApp.'
        : 'Your message could not be sent. Please try again, or message us on WhatsApp.',
    );
  }
  sendJson(res, 200, { sent: true }, { 'Cache-Control': 'no-store' });
}
