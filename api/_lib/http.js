// Small response helpers built on the plain Node request/response objects,
// so the handlers run the same on Vercel and on the local dev server.

const MAX_BODY_BYTES = 16 * 1024;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

export function sendError(res, status, code, message, extra = {}) {
  sendJson(res, status, { error: { code, message, ...extra } }, { 'Cache-Control': 'no-store' });
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendError(res, 405, 'METHOD_NOT_ALLOWED', `Use ${methods.join(' or ')} for this endpoint.`);
  return false;
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
}

export async function readJson(req) {
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  }
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the booking as JSON.');
  }

  // Vercel may already have parsed the body. Reading it can throw on bad JSON.
  let preParsed;
  try {
    preParsed = req.body;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  if (preParsed !== undefined && preParsed !== null) {
    if (typeof preParsed === 'string') return parse(preParsed);
    if (Buffer.isBuffer(preParsed)) return parse(preParsed.toString('utf8'));
    return preParsed;
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
    chunks.push(chunk);
  }
  return parse(Buffer.concat(chunks).toString('utf8') || 'null');
}
