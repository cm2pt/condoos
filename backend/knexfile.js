import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultDbFile = process.env.CONDOOS_DB_FILE
  ? path.resolve(process.env.CONDOOS_DB_FILE)
  : path.join(__dirname, "data", "condoos.sqlite");

const sqliteConnection = {
  filename: defaultDbFile,
};

const commonMigrations = {
  directory: path.join(__dirname, "migrations"),
};

const commonSeeds = {
  directory: path.join(__dirname, "seeds"),
};

const config = {
  development: {
    client: "better-sqlite3",
    connection: sqliteConnection,
    useNullAsDefault: true,
    migrations: commonMigrations,
    seeds: commonSeeds,
    pool: { afterCreate: (conn, cb) => { conn.pragma("journal_mode = WAL"); conn.pragma("foreign_keys = ON"); cb(); } },
  },

  test: {
    client: "better-sqlite3",
    connection: { filename: process.env.CONDOOS_DB_FILE ? path.resolve(process.env.CONDOOS_DB_FILE) : path.join(__dirname, "data", "condoos.test.sqlite") },
    useNullAsDefault: true,
    migrations: commonMigrations,
    seeds: commonSeeds,
    pool: { afterCreate: (conn, cb) => { conn.pragma("journal_mode = WAL"); conn.pragma("foreign_keys = ON"); cb(); } },
  },

  production: {
    client: "pg",
    connection: process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: process.env.PGHOST || "127.0.0.1",
          port: Number(process.env.PGPORT) || 5432,
          database: process.env.PGDATABASE || "condoos",
          user: process.env.PGUSER || "condoos",
          password: process.env.PGPASSWORD || "",
          ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
        },
    pool: { min: 0, max: 5 },
    migrations: commonMigrations,
    seeds: commonSeeds,
  },
};

export default config;
