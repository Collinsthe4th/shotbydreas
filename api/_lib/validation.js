// Server-side validation for booking requests. The form checks the same rules,
// but this is the one that counts.

import { isIsoDate } from './dates.js';
import { EVENT_TYPES, SERVICES } from './options.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^[+\d\s().-]+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const singleLine = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const multiLine = (v) =>
  typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';

export function validateBooking(body, { maxDates, firstBookable, lastBookable }) {
  const fields = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: { form: 'The request was not in the expected format.' } };
  }

  // Honeypot: real visitors never see or fill this field.
  if (singleLine(body.website)) {
    return { ok: false, fields: { form: 'The request could not be accepted.' } };
  }

  const name = singleLine(body.name);
  if (name.length < 2 || name.length > 80) fields.name = 'Enter your name (2 to 80 characters).';

  const phone = singleLine(body.phone);
  const phoneDigits = phone.replace(/\D/g, '').length;
  if (!PHONE_CHARS.test(phone) || phoneDigits < 7 || phoneDigits > 15) {
    fields.phone = 'Enter a valid phone number, e.g. +234 801 234 5678.';
  }

  const email = singleLine(body.email);
  if (email && (email.length > 254 || !EMAIL.test(email))) fields.email = 'Enter a valid email address or leave it empty.';

  const eventType = singleLine(body.eventType);
  if (!EVENT_TYPES.includes(eventType)) fields.eventType = 'Choose the type of event.';

  const service = singleLine(body.service);
  if (!SERVICES.includes(service)) fields.service = 'Choose a service.';

  const rawDates = Array.isArray(body.dates) ? body.dates : [];
  const dates = [...new Set(rawDates.filter((d) => typeof d === 'string'))].sort();
  if (dates.length === 0) {
    fields.dates = 'Pick at least one date.';
  } else if (dates.length > maxDates) {
    fields.dates = `Pick at most ${maxDates} dates.`;
  } else if (dates.length !== rawDates.length || !dates.every(isIsoDate)) {
    fields.dates = 'One of the dates is not valid.';
  } else if (dates[0] < firstBookable || dates[dates.length - 1] > lastBookable) {
    fields.dates = 'One of the dates is outside the booking window.';
  }

  const startTime = singleLine(body.startTime);
  if (startTime && !TIME.test(startTime)) fields.startTime = 'Enter a valid start time.';

  const location = singleLine(body.location);
  if (location.length < 2 || location.length > 120) fields.location = 'Enter the event location (2 to 120 characters).';

  const budget = singleLine(body.budget);
  if (budget.length > 60) fields.budget = 'Keep the budget under 60 characters.';

  const details = multiLine(body.details);
  if (details.length > 1000) fields.details = 'Keep the details under 1000 characters.';

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: { name, phone, email, eventType, service, dates, startTime, location, budget, details },
  };
}
