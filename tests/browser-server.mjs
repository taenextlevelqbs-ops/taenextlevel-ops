// Test-only local credentials and provider fixtures; never loaded in deployment.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const preload = fileURLToPath(
  new URL("./provider-preload.mjs", import.meta.url),
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3210",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `--import=${preload}`,
      COMMAND_ADMIN_EMAIL: "takwancrews@gmail.com",
      COMMAND_OWNER_USER_ID: "00000000-0000-4000-8000-000000000001",
      COMMAND_ORIGIN: "http://127.0.0.1:3210",
      COMMAND_DB_ANON_KEY: "test-only-public-key",
      COMMAND_SESSION_SECRET: randomBytes(32).toString("hex"),
      COMMAND_DB_URL: "https://command-test.supabase.co",
      COMMAND_DB_SERVICE_KEY: "test-only-key",
      COMMAND_GITHUB_TOKEN: "",
      GH_TOKEN: "",
      COMMAND_VERCEL_TOKEN: "",
      GOOGLE_SERVICE_ACCOUNT_JSON: "",
      COMMAND_SENTRY_TOKEN: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
