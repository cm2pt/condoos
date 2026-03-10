import { DEMO_USERS, getDatabasePath, initializeDatabase } from "../db.js";

const shouldReset = process.argv.includes("--reset");
const shouldForce = shouldReset || process.argv.includes("--force");

const result = initializeDatabase({
  reset: shouldReset,
  forceSeed: shouldForce,
});

console.log(`[db] sqlite path: ${getDatabasePath()}`);
console.log(result.seeded ? "[db] seed applied from synthetic dataset." : "[db] seed skipped (already initialized).");
console.log("[db] demo users:");
for (const user of DEMO_USERS) {
  console.log(`- ${user.email} (${user.role}) / ${user.password}`);
}
