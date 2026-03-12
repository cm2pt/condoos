import { createServer } from "../backend/server.js";

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  // Vercel's Node.js runtime delivers req.body as a pre-parsed JS object
  // (for JSON content-type). The readable stream may or may not still be
  // available. We unconditionally mark the body as processed so
  // express.json() does not attempt to re-read/re-parse the stream.
  req._body = true;

  // If body is not yet a plain object (e.g. Buffer or string), parse it
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString("utf8") || "{}"); } catch { req.body = {}; }
  } else if (typeof req.body === "string") {
    try { req.body = JSON.parse(req.body || "{}"); } catch { req.body = {}; }
  } else if (req.body === undefined || req.body === null) {
    req.body = {};
  }

  const expressApp = await getApp();
  return expressApp(req, res);
}
