import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { databaseConfigured, db } from "../lib/store.mjs";
loadEnvConfig(process.cwd());
const required = [
  "COMMAND_ORIGIN",
  "COMMAND_ADMIN_EMAIL",
  "COMMAND_DB_ANON_KEY",
  "COMMAND_OWNER_USER_ID",
  "COMMAND_SESSION_SECRET",
  "COMMAND_DB_URL",
  "COMMAND_DB_SERVICE_KEY",
  "CRON_SECRET",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    "Missing production configuration names: " + missing.join(", "),
  );
  process.exit(1);
}
let failures = [];
try {
  const u = new URL(process.env.COMMAND_ORIGIN);
  if (u.protocol !== "https:" || u.origin !== process.env.COMMAND_ORIGIN)
    failures.push(
      "COMMAND_ORIGIN must be an exact HTTPS origin without trailing slash",
    );
} catch {
  failures.push("COMMAND_ORIGIN is invalid");
}
if (!/^[a-f0-9-]{36}$/i.test(process.env.COMMAND_OWNER_USER_ID))
  failures.push("COMMAND_OWNER_USER_ID must be the Supabase owner user UUID");
for (const key of ["COMMAND_SESSION_SECRET", "CRON_SECRET"])
  if (process.env[key].length < 32)
    failures.push(`${key} must be at least 32 characters`);
if (!databaseConfigured()) failures.push("Database is not configured");
if (!failures.length) {
  try {
    await db("command_sites?select=id&limit=1");
    await db("command_uptime?select=id&limit=1");
    await db("command_daily_metrics?select=day&limit=1");
    console.log("Command Center database tables are reachable.");
  } catch {
    failures.push("Database access or migration verification failed");
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "Core production prerequisites verified. Provider connections and deployed auth/cron must still be checked in production.",
);
