import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { jsonRequest, supabaseOrigin } from "./http.mjs";
import { signSession } from "./core.mjs";
export const REFRESH_COOKIE = "command_refresh";
export const REFRESH_TTL = 30 * 86400;
export function sealRefresh(
  token,
  secret,
  now = Date.now(),
  expires = now + REFRESH_TTL * 1000,
) {
  if (
    !secret ||
    secret.length < 32 ||
    typeof token !== "string" ||
    !token ||
    token.length > 2048
  )
    throw new Error("Invalid refresh configuration");
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256").update(`command-refresh-v1:${secret}`).digest(),
      iv,
    );
  const value = Buffer.concat([
    cipher.update(JSON.stringify({ token, expires })),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), value]).toString("base64url");
}
export function openRefresh(value, secret, now = Date.now()) {
  try {
    if (
      !secret ||
      secret.length < 32 ||
      typeof value !== "string" ||
      value.length > 4096
    )
      return null;
    const bytes = Buffer.from(value, "base64url"),
      decipher = createDecipheriv(
        "aes-256-gcm",
        createHash("sha256").update(`command-refresh-v1:${secret}`).digest(),
        bytes.subarray(0, 12),
      );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
    return typeof data.token === "string" &&
      data.expires > now &&
      data.expires <= now + REFRESH_TTL * 1000
      ? data
      : null;
  } catch {
    return null;
  }
}
export async function renewSession(value, env = process.env, fetcher = fetch) {
  const stored = openRefresh(value, env.COMMAND_SESSION_SECRET);
  if (!stored || !env.COMMAND_OWNER_USER_ID || !env.COMMAND_DB_ANON_KEY)
    return null;
  try {
    const data = await jsonRequest(
      `${supabaseOrigin(env.COMMAND_DB_URL)}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: env.COMMAND_DB_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: stored.token }),
      },
      fetcher,
    );
    const email = env.COMMAND_ADMIN_EMAIL || "takwancrews@gmail.com";
    if (
      data.user?.id !== env.COMMAND_OWNER_USER_ID ||
      data.user.email?.toLowerCase() !== email.toLowerCase() ||
      !data.user.email_confirmed_at ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0 ||
      !data.refresh_token
    )
      return null;
    const expiresIn = Math.min(3600, data.expires_in);
    return {
      token: signSession(
        email,
        env.COMMAND_SESSION_SECRET,
        Date.now(),
        expiresIn,
        data.user.id,
      ),
      expiresIn,
      refresh: sealRefresh(
        data.refresh_token,
        env.COMMAND_SESSION_SECRET,
        Date.now(),
        stored.expires,
      ),
      refreshTtl: Math.max(0, Math.floor((stored.expires - Date.now()) / 1000)),
    };
  } catch {
    return null;
  }
}
