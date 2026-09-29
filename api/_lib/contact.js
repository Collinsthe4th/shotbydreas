// Contact form: validation and delivery to Dreas's Gmail through the Apps Script web app
// (google-apps-script/Code.gs, doPost). The same script URL and key as the calendar feed.

import { UpstreamError } from './google.js';

const TIMEOUT_MS = 12000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateContact(input) {
  const body = input && typeof input === 'object' ? input : {};
  const value = {
    name: text(body.name),
    email: text(body.email),
    subject: text(body.subject),
    message: text(body.message),
  };
  const fields = {};
  if (value.name.length < 2) fields.name = 'Enter your name.';
  else if (value.name.length > 80) fields.name = 'Keep your name under 80 characters.';
  if (!value.email) fields.email = 'Enter your email so Dreas can reply.';
  else if (value.email.length > 120 || !EMAIL_RE.test(value.email)) fields.email = 'Check your email address.';
  if (value.subject.length > 120) fields.subject = 'Keep the subject under 120 characters.';
  if (value.message.length < 5) fields.message = 'Write a short message.';
  else if (value.message.length > 2000) fields.message = 'Keep your message under 2000 characters.';

  // Honeypot: real visitors never see or fill the "website" field.
  const isBot = text(body.website).length > 0;
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value, isBot };
}

export async function sendContactViaScript(script, message, { fetchImpl = fetch } = {}) {
  let res;
  try {
    // Apps Script answers a POST with a redirect, and fetch follows it with a GET to read the result.
    res = await fetchImpl(script.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: script.key, action: 'contact', ...message }),
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new UpstreamError('SCRIPT_UNREACHABLE', `Apps Script request failed: ${err.name}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new UpstreamError('SCRIPT_BAD_RESPONSE', `Apps Script returned ${res.status} without JSON.`);
  if (data.error) {
    const err = new UpstreamError('SCRIPT_ERROR', `Apps Script error: ${data.error}${data.reason ? ` (${data.reason})` : ''}`);
    err.reason = data.error;
    throw err;
  }
  return true;
}
