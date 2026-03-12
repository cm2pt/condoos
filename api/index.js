import { createServer } from "../backend/server.js";

export const config = {
  api: { bodyParser: false },
};

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  // Debug: log what Vercel gives us
  if (req.url && req.url.includes("debug-body")) {
    // Try to read the stream to see what's in it
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");

    return res.status(200).json({
      url: req.url,
      method: req.method,
      bodyType: typeof req.body,
      parsedBody: typeof req.body === "object" ? req.body : null,
      rawBodyFromStream: rawBody,
      rawBodyLength: rawBody.length,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"],
    });
  }

  // If Vercel pre-parsed the body, tell Express not to re-parse
  if (req.body !== undefined && req.body !== null) {
    req._body = true;
  }

  const expressApp = await getApp();
  return expressApp(req, res);
}
