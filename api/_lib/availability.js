// Turns Google free/busy data into a list of booked calendar days.

import { addDays, busyDates, startOfLocalDay, todayIn } from './dates.js';
import { queryBusyViaScript } from './apps-script.js';
import { usesAppsScript } from './config.js';
import { queryBusy } from './google.js';

// freeBusy queries are kept to 60-day chunks to stay well inside Google's range limits.
const CHUNK_DAYS = 60;

export function getBookingWindow(config, now = new Date()) {
  const today = todayIn(config.timeZone, now);
  return {
    timeZone: config.timeZone,
    today,
    firstBookable: addDays(today, config.minNoticeDays),
    lastBookable: addDays(today, config.windowDays),
    maxDates: config.maxDates,
  };
}

// Booked days between fromDate and toDate (inclusive), sorted.
// Any busy event on a day books the whole day. Events set to "Show as: Free" are ignored by Google.
export async function getUnavailableDates(config, fromDate, toDate, deps = {}) {
  const { timeZone } = config;
  // The Apps Script feed is used when configured, otherwise the service account.
  const query = usesAppsScript(config)
    ? (min, max) => queryBusyViaScript(config.script, min, max, deps)
    : (min, max) => queryBusy(config.google, min, max, deps);
  const chunks = [];
  for (let start = fromDate; start <= toDate; start = addDays(start, CHUNK_DAYS)) {
    const lastDay = addDays(start, CHUNK_DAYS - 1);
    const end = lastDay < toDate ? lastDay : toDate;
    chunks.push([start, end]);
  }

  const results = await Promise.all(
    chunks.map(([start, end]) =>
      query(startOfLocalDay(start, timeZone).toISOString(), startOfLocalDay(addDays(end, 1), timeZone).toISOString()),
    ),
  );

  const days = busyDates(results.flat(), timeZone);
  return [...days].filter((d) => d >= fromDate && d <= toDate).sort();
}
