// External-service fixture only. Loaded explicitly by the browser test launcher via NODE_OPTIONS.
// This module is never imported by production application code.
const nativeFetch = globalThis.fetch;
let attempts = 0;
globalThis.fetch = async (url, options = {}) => {
  const address = String(url);
  if (!address.startsWith("https://command-test.supabase.co/"))
    return nativeFetch(url, options);
  if (address.includes("/auth/v1/token")) {
    const body = JSON.parse(options.body);
    return body.password === "browser-test-password-only"
      ? Response.json({
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "takwancrews@gmail.com",
            email_confirmed_at: "2026-01-01",
          },
          expires_in: 3600,
          access_token: "test-token-never-exposed",
          refresh_token: "test-refresh-never-exposed",
        })
      : Response.json({ error: "invalid credentials" }, { status: 400 });
  }
  if (address.includes("rpc/command_login_attempt"))
    return Response.json(++attempts <= 8);
  if (address.includes("command_sites") && options.method === "POST")
    return Response.json(
      { message: "fixture database is read-only" },
      { status: 503 },
    );
  if (address.includes("command_sites")) return Response.json([]);
  if (address.includes("command_daily_metrics")) return Response.json([]);
  if (address.includes("command_uptime")) return Response.json([]);
  return Response.json(
    { error: "unimplemented test fixture" },
    { status: 404 },
  );
};
