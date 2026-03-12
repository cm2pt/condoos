import { createServer } from "../backend/server.js";

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  // Vercel's Node.js runtime pre-reads the request body from the stream,
  // making it unavailable for Express's body-parser. The body is available
  // as req.body (Buffer or string). We parse it into JSON and mark it as
  // already processed so express.json() doesn't hang on the empty stream.
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
      try {
        const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
    }
    req._body = true;
  }
  const expressApp = await getApp();
  return expressApp(req, res);
}
