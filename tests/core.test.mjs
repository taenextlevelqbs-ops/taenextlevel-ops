import test from "node:test";
import assert from "node:assert/strict";
import {
  periodRange,
  change,
  aggregate,
  metric,
  unavailable,
  signSession,
  readSession,
  validateSite,
} from "../lib/core.mjs";
import { isPublicAddress, checkPublicUrl, jsonRequest } from "../lib/http.mjs";
import { login } from "../lib/login.mjs";
const secret = "test-only-session-secret-more-than-32-chars";
const email = "takwancrews@gmail.com";
const ownerId = "00000000-0000-4000-8000-000000000001";
const provider = async (_url, options) => {
  const body = JSON.parse(options.body);
  return body.password === "test-only-password"
    ? Response.json({
        user: { id: ownerId, email, email_confirmed_at: "2026-01-01" },
        expires_in: 3600,
        access_token: "secret-provider-token",
      })
    : new Response(null, { status: 400 });
};
const env = {
  NODE_ENV: "production",
  COMMAND_ORIGIN: "https://command.example.com",
  COMMAND_ADMIN_EMAIL: email,
  COMMAND_DB_URL: "https://project.supabase.co",
  COMMAND_DB_SERVICE_KEY: "test-key",
  COMMAND_DB_ANON_KEY: "test-public-key",
  COMMAND_OWNER_USER_ID: ownerId,
  COMMAND_SESSION_SECRET: secret,
};
const request = (body, origin = env.COMMAND_ORIGIN) =>
  new Request(env.COMMAND_ORIGIN + "/api/auth/login", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("periods use nonoverlapping UTC windows and equal prior periods across leap days", () => {
  const r = periodRange("month", new Date("2024-03-01T23:00:00Z"));
  assert.equal(r.start, "2024-02-01T00:00:00.000Z");
  assert.equal(r.end, "2024-03-02T00:00:00.000Z");
  assert.equal(
    Date.parse(r.start) - Date.parse(r.previousStart),
    Date.parse(r.end) - Date.parse(r.start),
  );
  assert.equal(r.previousEnd, r.start);
  assert.equal(periodRange("bad").period, "month");
});
test("unavailable data remains null and portfolio sums retain coverage", () => {
  assert.equal(unavailable("missing").value, null);
  assert.equal(metric(NaN, "x").value, null);
  assert.deepEqual(
    aggregate(
      [
        { v: metric(0, "x") },
        { v: unavailable("missing") },
        { v: metric(4, "x") },
      ],
      "v",
    ),
    { value: 4, covered: 2, total: 3 },
  );
  assert.equal(aggregate([{ v: unavailable("x") }], "v").value, null);
  assert.equal(change(8, 0), null);
  assert.equal(change(8, 4), 100);
});
test("session signatures enforce owner, expiry, rotation and reject tampering", () => {
  const token = signSession(email, secret, 1000);
  assert.ok(readSession(token, secret, email, 1001));
  assert.equal(readSession(token + "a", secret, email, 1001), null);
  assert.equal(readSession(token, secret, "other@example.com", 1001), null);
  assert.equal(readSession(token, secret, email, 1000 + 8 * 3600000), null);
  assert.equal(
    readSession(token, "different-secret-which-is-also-long", email, 1001),
    null,
  );
  assert.equal(readSession(token, secret, email, 0), null);
});
test("login blocks cross-site requests, unconfigured production throttling and malformed requests", async () => {
  assert.equal(
    (
      await login(
        request(
          { email, password: "test-only-password" },
          "https://evil.example",
        ),
        env,
        async () => true,
        provider,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await login(request({ email, password: "test-only-password" }), {
        ...env,
        COMMAND_DB_SERVICE_KEY: "",
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await login(
        request({ email, password: 123 }),
        env,
        async () => true,
        provider,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await login(
        request({ email, password: "test-only-password" }),
        {},
        async () => true,
      )
    ).status,
    503,
  );
});
test("login checks credentials, throttle and provider failures before creating sessions", async () => {
  assert.equal(
    (
      await login(
        request({ email, password: "wrong" }),
        env,
        async () => true,
        provider,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await login(
        request({ email: "other@example.com", password: "test-only-password" }),
        env,
        async () => true,
        provider,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await login(
        request({ email, password: "test-only-password" }),
        env,
        async () => false,
      )
    ).status,
    429,
  );
  assert.equal(
    (
      await login(
        request({ email, password: "test-only-password" }),
        env,
        async () => {
          throw new Error("private-key");
        },
      )
    ).status,
    503,
  );
  const result = await login(
    request({ email, password: "test-only-password" }),
    env,
    async () => true,
    provider,
  );
  assert.equal(result.status, 200);
  assert.ok(readSession(result.token, secret, email, Date.now(), ownerId));
  assert.equal(result.expiresIn, 3600);
  assert.equal(JSON.stringify(result).includes("secret-provider-token"), false);
});
test("site configuration rejects private URLs, credential URLs, invalid IDs and injected provider paths", () => {
  const valid = {
    id: "my-site",
    name: "My site",
    url: "https://example.com",
    repository: "owner/repo",
  };
  assert.equal(validateSite(valid).url, "https://example.com");
  for (const url of [
    "http://example.com",
    "https://127.0.0.1",
    "https://user:password@example.com",
    "https://example.com:4433",
    "https://service.internal",
  ])
    assert.throws(() => validateSite({ ...valid, url }));
  assert.throws(() => validateSite({ ...valid, id: "../secret" }));
  assert.throws(() =>
    validateSite({ ...valid, sentryProject: "organization/../../token" }),
  );
  assert.throws(() => validateSite({ ...valid, ga4Property: "12:runReport" }));
});
test("SSRF defenses reject private IPv4, IPv6, mapped addresses and mixed DNS results", async () => {
  for (const addr of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.2.3",
    "192.168.1.1",
    "100.64.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "224.0.0.1",
  ])
    assert.equal(isPublicAddress(addr), false, addr);
  assert.equal(isPublicAddress("93.184.216.34"), true);
  await assert.rejects(
    checkPublicUrl("https://example.com", async () => [
      { address: "93.184.216.34" },
      { address: "10.0.0.1" },
    ]),
  );
  await assert.rejects(checkPublicUrl("https://127.0.0.1"));
  assert.equal(
    (
      await checkPublicUrl("https://example.com", async () => [
        { address: "93.184.216.34", family: 4 },
      ])
    ).hostname,
    "example.com",
  );
});
test("provider failures sanitize credentials and 204 writes are accepted", async () => {
  await assert.rejects(
    jsonRequest("https://example.com", {}, async () => {
      throw new Error("secret credential");
    }),
    /Service unreachable/,
  );
  assert.equal(
    await jsonRequest(
      "https://example.com",
      {},
      async () => new Response(null, { status: 204 }),
    ),
    null,
  );
  await assert.rejects(
    jsonRequest(
      "https://example.com",
      {},
      async () => new Response("secret", { status: 403 }),
    ),
    /Access denied/,
  );
});

test("Supabase Auth must confirm the exact owner UUID and verified email before granting access", async () => {
  for (const user of [
    { id: "other-id", email, email_confirmed_at: "2026-01-01" },
    {
      id: ownerId,
      email: "other@example.com",
      email_confirmed_at: "2026-01-01",
    },
    { id: ownerId, email },
  ]) {
    const result = await login(
      request({ email, password: "test-only-password" }),
      env,
      async () => true,
      async () => Response.json({ user, expires_in: 3600 }),
    );
    assert.equal(result.status, 401);
  }
  assert.equal(
    (
      await login(
        request({ email, password: "test-only-password" }),
        env,
        async () => true,
        async () => new Response(null, { status: 503 }),
      )
    ).status,
    503,
  );
});
