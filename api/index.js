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
  // Clear Vercel's pre-parsed body so Express can parse from the stream
  delete req.body;

  const expressApp = await getApp();
  return expressApp(req, res);
}
