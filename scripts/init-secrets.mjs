// Generates only server session and scheduler secrets, preserving existing settings.
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const file = new URL("../.env.local", import.meta.url);
let existing = "";
try {
  existing = await readFile(file, "utf8");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const lines = [];
for (const key of ["COMMAND_SESSION_SECRET", "CRON_SECRET"])
  if (!new RegExp(`^${key}=`, "m").test(existing))
    lines.push(`${key}=${randomBytes(32).toString("hex")}`);
if (!/^COMMAND_ADMIN_EMAIL=/m.test(existing))
  lines.push("COMMAND_ADMIN_EMAIL=takwancrews@gmail.com");
if (lines.length)
  await writeFile(
    file,
    existing.replace(/\s*$/, "") + "\n" + lines.join("\n") + "\n",
    { mode: 0o600 },
  );
console.log(
  "Server secret configuration prepared in ignored .env.local. Existing values were preserved. No secret values were printed. Import securely into Vercel; create the owner password directly in the dedicated Supabase Auth project.",
);
