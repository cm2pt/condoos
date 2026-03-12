import { createServer } from "../backend/server.js";

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  // Debug endpoint to inspect what Vercel sends
  if (req.url === "/api/debug-body") {
    return res.status(200).json({
      bodyType: typeof req.body,
      isBuffer: Buffer.isBuffer(req.body),
      bodyIsNull: req.body === null,
      bodyIsUndefined: req.body === undefined,
      bodyStringified: Buffer.isBuffer(req.body) ? req.body.toString("utf8").slice(0, 200) : String(req.body).slice(0, 200),
      method: req.method,
      contentType: req.headers["content-type"],
      hasReadableState: !!req._readableState,
      readableEnded: req.readableEnded,
    });
  }

  // Vercel pre-reads the request body stream. Without this workaround,
  // express.json() hangs or fails on the consumed stream.
  try {
    const hasBody = req.body !== undefined && req.body !== null;

    if (hasBody) {
      if (Buffer.isBuffer(req.body)) {
        const raw = req.body.toString("utf8").trim();
        req.body = raw ? JSON.parse(raw) : {};
      } else if (typeof req.body === "string") {
        const trimmed = req.body.trim();
        req.body = trimmed ? JSON.parse(trimmed) : {};
      }
    } else if (["POST", "PUT", "PATCH"].includes(req.method)) {
      req.body = {};
    }
  } catch (e) {
    return res.status(400).json({ error: "JSON invalido no corpo do pedido.", detail: e.message });
  }

  req._body = true;

  const expressApp = await getApp();
  return expressApp(req, res);
}
