import Knex from "knex";
import knexConfig from "./knexfile.js";

const env = process.env.DATABASE_URL ? "production" : (process.env.NODE_ENV || "development");
const config = knexConfig[env] || knexConfig.development;

let instance = null;

export function getKnex() {
  if (!instance) {
    instance = Knex(config);
  }
  return instance;
}

export async function initializeKnex({ migrate = true, seed = false } = {}) {
  const knex = getKnex();

  if (migrate) {
    await knex.migrate.latest();
  }

  if (seed) {
    const count = await knex("tenants").count("id as total").first();
    if (Number(count?.total || 0) === 0) {
      await knex.seed.run();
    }
  }

  return knex;
}

export async function destroyKnex() {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
