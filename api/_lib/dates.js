// Date helpers. Calendar days are plain "YYYY-MM-DD" strings in the booking time zone,
// which keeps day arithmetic free of time-zone bugs.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const formatters = new Map();
function partsIn(instant, timeZone) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, fmt);
  }
  const parts = {};
  for (const p of fmt.formatToParts(instant)) parts[p.type] = p.value;
  return parts;
}

// The calendar day an instant falls on, in the given time zone.
export function localDateOf(instant, timeZone) {
  const p = partsIn(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

function offsetMs(instantMs, timeZone) {
  const p = partsIn(new Date(instantMs), timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

// The instant local midnight starts on the given day.
export function startOfLocalDay(isoDate, timeZone) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(guess, timeZone);
  return new Date(guess - offsetMs(first, timeZone));
}

export function todayIn(timeZone, now = new Date()) {
  return localDateOf(now, timeZone);
}

// Every local day touched by at least one busy period.
// A period ending exactly at midnight (all-day events) does not touch the next day.
export function busyDates(busy, timeZone) {
  const days = new Set();
  for (const period of busy) {
    const start = new Date(period.start);
    const end = new Date(period.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    let day = localDateOf(start, timeZone);
    const last = localDateOf(new Date(end.getTime() - 1), timeZone);
    for (let guard = 0; day <= last && guard < 1000; guard += 1) {
      days.add(day);
      day = addDays(day, 1);
    }
  }
  return days;
}

export function formatDisplayDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
