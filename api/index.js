import { createServer } from "../backend/server.js";

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
