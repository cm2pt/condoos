import { createServer } from "../backend/server.js";

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  // Vercel pre-reads the request body stream. Without this workaround,
  // express.json() would try to read the already-consumed stream and
  // either hang (timeout) or fail (400 empty body).
  //
  // Strategy: always mark body as processed. If Vercel provided a body,
  // ensure it's a parsed JS object. If not, default to empty object for
  // methods that typically have a body.
  const hasBody = req.body !== undefined && req.body !== null;

  if (hasBody) {
    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString("utf8").trim();
      req.body = raw ? JSON.parse(raw) : {};
    } else if (typeof req.body === "string") {
      const trimmed = req.body.trim();
      req.body = trimmed ? JSON.parse(trimmed) : {};
    }
    // else: already an object — Vercel may have parsed it
  } else if (["POST", "PUT", "PATCH"].includes(req.method)) {
    req.body = {};
  }

  // Tell Express the body is already available — skip stream reading
  req._body = true;

  const expressApp = await getApp();
  return expressApp(req, res);
}
