import { createServer } from "../backend/server.js";

// Disable Vercel's built-in body parsing so Express can handle it natively.
// This prevents the double-parse issue where Vercel pre-reads the stream
// and Express's json() middleware then fails on the consumed stream.
export const config = {
  api: {
    bodyParser: false,
  },
};

let app;

async function getApp() {
  if (!app) {
    app = await createServer();
  }
  return app;
}

export default async function handler(req, res) {
  const expressApp = await getApp();
  return expressApp(req, res);
}
