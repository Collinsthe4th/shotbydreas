// Free alternative to the service account: an Apps Script web app running in Dreas's
// Google account (see google-apps-script/Code.gs) returns his busy periods.

import { UpstreamError } from './google.js';

const TIMEOUT_MS = 9000;

export async function queryBusyViaScript(script, timeMin, timeMax, { fetchImpl = fetch } = {}) {
  const url = new URL(script.url);
  url.searchParams.set('key', script.key);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);

  let res;
  try {
    // Apps Script answers with a redirect to googleusercontent.com, which fetch follows.
    res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new UpstreamError('SCRIPT_UNREACHABLE', `Apps Script request failed: ${err.name}`);
  }

  // Apps Script always replies 200, so errors come back in the body.
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    // An HTML page instead of JSON usually means the web app is not shared with "Anyone".
    throw new UpstreamError('SCRIPT_BAD_RESPONSE', `Apps Script returned ${res.status} without JSON.`);
  }
  if (data.error) {
    throw new UpstreamError('SCRIPT_ERROR', `Apps Script error: ${data.error}${data.reason ? ` (${data.reason})` : ''}`);
  }
  return Array.isArray(data.busy) ? data.busy : [];
}
