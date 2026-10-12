import { createHmac } from "node:crypto";
import { db, databaseConfigured } from "./store.mjs";
import { signSession, validOrigin } from "./core.mjs";
import { supabaseOrigin } from "./http.mjs";
export async function login(
  request,
  env = process.env,
  limiter = null,
  fetcher = fetch,
) {
  const origin =
    env.COMMAND_ORIGIN ||
    (env.NODE_ENV !== "production" ? new URL(request.url).origin : null);
  if (!validOrigin(request, origin))
    return { status: 403, error: "This request is not allowed." };
  if (
    !databaseConfigured(env) ||
    !env.COMMAND_DB_ANON_KEY ||
    !env.COMMAND_OWNER_USER_ID ||
    !env.COMMAND_SESSION_SECRET ||
    env.COMMAND_SESSION_SECRET.length < 32
  )
    return {
      status: 503,
      error: "Secure sign-in is not configured. Contact the dashboard owner.",
    };
  let body;
  try {
    const text = await request.text();
    if (text.length > 2048)
      return { status: 413, error: "Request is too large." };
    body = JSON.parse(text);
  } catch {
    return { status: 400, error: "Invalid sign-in request." };
  }
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    body.password.length > 256
  )
    return { status: 400, error: "Enter a valid email and password." };
  try {
    const allowed = limiter
      ? await limiter()
      : await db(
          "rpc/command_login_attempt",
          {
            method: "POST",
            body: JSON.stringify({
              bucket: createHmac("sha256", env.COMMAND_SESSION_SECRET)
                .update("owner-login")
                .digest("hex"),
            }),
          },
          env,
          fetcher,
        );
    if (allowed !== true)
      return {
        status: 429,
        error: "Too many sign-in attempts. Try again in 15 minutes.",
      };
  } catch {
    return {
      status: 503,
      error: "Secure sign-in is temporarily unavailable.",
      diagnostic: "login_rate_limit_unavailable",
    };
  }
  const email = env.COMMAND_ADMIN_EMAIL || "takwancrews@gmail.com";
  if (body.email.trim().toLowerCase() !== email.toLowerCase())
    return { status: 401, error: "Email or password is incorrect." };
  try {
    const response = await fetcher(
      `${supabaseOrigin(env.COMMAND_DB_URL)}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: env.COMMAND_DB_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password: body.password }),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if ([400, 401].includes(response.status))
      return { status: 401, error: "Email or password is incorrect." };
    if (!response.ok)
      return {
        status: 503,
        error: "Secure sign-in is temporarily unavailable.",
        diagnostic: `supabase_auth_http_${response.status}`,
      };
    const data = await response.json();
    if (
      !data.user ||
      data.user.id !== env.COMMAND_OWNER_USER_ID ||
      data.user.email?.toLowerCase() !== email.toLowerCase() ||
      !data.user.email_confirmed_at ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      return {
        status: 401,
        error: "This account is not authorized for the workspace.",
      };
    const expiresIn = Math.min(data.expires_in, 3600);
    // Provider access/refresh tokens are intentionally not exposed or retained.
    return {
      status: 200,
      expiresIn,
      token: signSession(
        email,
        env.COMMAND_SESSION_SECRET,
        Date.now(),
        expiresIn,
        data.user.id,
      ),
    };
  } catch {
    return {
      status: 503,
      error: "Secure sign-in is temporarily unavailable.",
      diagnostic: "supabase_auth_network_or_response_error",
    };
  }
}
