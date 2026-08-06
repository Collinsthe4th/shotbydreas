// Builds the pre-filled WhatsApp message and the click-to-chat link.

import { formatDisplayDate } from './dates.js';

export function buildBookingMessage(booking) {
  const lines = [
    "Hello Dreas, I'd like to book you. Here are my details from the website:",
    '',
    `*Name:* ${booking.name}`,
    `*Phone:* ${booking.phone}`,
  ];
  if (booking.email) lines.push(`*Email:* ${booking.email}`);
  lines.push(
    `*Event:* ${booking.eventType}`,
    `*Service:* ${booking.service}`,
    `*Date${booking.dates.length > 1 ? 's' : ''}:* ${booking.dates.map(formatDisplayDate).join(' · ')}`,
  );
  if (booking.startTime) lines.push(`*Start time:* ${booking.startTime}`);
  lines.push(`*Location:* ${booking.location}`);
  if (booking.budget) lines.push(`*Budget:* ${booking.budget}`);
  if (booking.details) lines.push('', '*Details:*', booking.details);
  return lines.join('\n');
}

export function buildWhatsAppUrl(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
