import { createServer } from "../backend/server.js";

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  // Vercel's runtime pre-parses the request body, consuming the readable
  // stream. We must signal Express that the body is already available so
  // express.json() doesn't hang trying to re-read an empty stream.
  if (req.body !== undefined) {
    req._body = true;
  }
  const expressApp = await getApp();
  return expressApp(req, res);
}
