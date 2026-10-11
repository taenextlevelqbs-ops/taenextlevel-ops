import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "./core.mjs";
export const COOKIE = "command_session";
export async function session() {
  const store = await cookies();
  if (!process.env.COMMAND_OWNER_USER_ID) return null;
  return readSession(
    store.get(COOKIE)?.value,
    process.env.COMMAND_SESSION_SECRET,
    process.env.COMMAND_ADMIN_EMAIL || "takwancrews@gmail.com",
    Date.now(),
    process.env.COMMAND_OWNER_USER_ID,
  );
}
export async function requireSession() {
  const user = await session();
  if (!user) redirect("/login");
  return user;
}
