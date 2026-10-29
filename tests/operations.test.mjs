import test from "node:test";
import assert from "node:assert/strict";
import {
  upcomingBookings,
  paymentActivity,
  novaHealth,
  dmvRecords,
} from "../lib/operations.mjs";
import { sealRefresh, openRefresh, renewSession } from "../lib/refresh.mjs";
import { payments } from "../lib/adapters.mjs";
const coach = { id: "coach-tae", envPrefix: "COACH_TAE", name: "Coach Tae" };
const dmv = { id: "dmv-attack", envPrefix: "DMV_ATTACK", name: "DMV Attack" };
const secret = "unit-test-secret-".repeat(4);
test("encrypted persistent sessions resist tampering, expiry and key rotation", () => {
  const token = sealRefresh("provider-refresh-value", secret, 1000, 6000);
  assert.equal(token.includes("provider-refresh"), false);
  assert.equal(
    openRefresh(token, secret, 2000).token,
    "provider-refresh-value",
  );
  assert.equal(openRefresh(token, secret, 7000), null);
  assert.equal(openRefresh(token, secret + "rotated", 2000), null);
  assert.equal(openRefresh(token.slice(0, -8) + "invalid", secret, 2000), null);
});
test("session renewal validates verified owner and rotates encrypted material", async () => {
  const env = {
    COMMAND_SESSION_SECRET: secret,
    COMMAND_OWNER_USER_ID: "owner",
    COMMAND_ADMIN_EMAIL: "owner@example.com",
    COMMAND_DB_URL: "https://test.supabase.co",
    COMMAND_DB_ANON_KEY: "public",
  };
  const refresh = sealRefresh("old", secret);
  const user = {
    id: "owner",
    email: "owner@example.com",
    email_confirmed_at: "2026-01-01",
  };
  const fetcher = async () =>
    Response.json({ user, expires_in: 3600, refresh_token: "new" });
  const renewed = await renewSession(refresh, env, fetcher);
  assert.equal(openRefresh(renewed.refresh, secret).token, "new");
  assert.equal(
    await renewSession(refresh, env, async () =>
      Response.json({
        user: { ...user, id: "other" },
        expires_in: 3600,
        refresh_token: "bad",
      }),
    ),
    null,
  );
  assert.equal(
    await renewSession(
      refresh,
      env,
      async () => new Response("", { status: 401 }),
    ),
    null,
  );
});
test("Stripe never reads payment records for shared keys, shared accounts or wrong account identity", async () => {
  let reads = 0;
  const fetcher = async (url) => {
    reads++;
    assert.equal(String(url).endsWith("/account"), true);
    return Response.json({ id: "acct_wrong" });
  };
  const cases = [
    { COACH_TAE_STRIPE_READ_KEY: "same", DMV_ATTACK_STRIPE_READ_KEY: "same" },
    {
      COACH_TAE_STRIPE_READ_KEY: "coach",
      COACH_TAE_STRIPE_ACCOUNT_ID: "acct_same",
      DMV_ATTACK_STRIPE_ACCOUNT_ID: "acct_same",
    },
    {
      COACH_TAE_STRIPE_READ_KEY: "coach",
      COACH_TAE_STRIPE_ACCOUNT_ID: "acct_coach",
    },
  ];
  for (const env of cases) {
    assert.equal(
      (await paymentActivity(coach, env, fetcher)).status,
      "Unavailable",
    );
    assert.equal(
      (
        await payments(
          coach,
          { start: "2026-01-01", end: "2026-02-01" },
          env,
          fetcher,
        )
      ).count.value,
      null,
    );
  }
  assert.equal(reads, 2);
});
test("Calendly paginates future events, filters canceled sessions and discards partial failures", async () => {
  const env = {
    COACH_TAE_CALENDLY_TOKEN: "test",
    COACH_TAE_CALENDLY_USER_URI: "https://api.calendly.com/users/test",
  };
  let calls = 0;
  const r = await upcomingBookings(
    coach,
    env,
    async () =>
      Response.json({
        collection: [
          {
            uri: String(++calls),
            name: "Training",
            status: calls === 1 ? "active" : "canceled",
            start_time: "2026-11-02T15:00:00Z",
            end_time: "2026-11-02T16:00:00Z",
          },
        ],
        pagination: { next_page_token: calls === 1 ? "next" : null },
      }),
    new Date("2026-10-29T12:00:00Z"),
  );
  assert.equal(r.items.length, 1);
  assert.equal(calls, 2);
  assert.equal(
    (
      await upcomingBookings(
        coach,
        env,
        async () => new Response("", { status: 403 }),
      )
    ).measuredAt,
    null,
  );
});
test("unavailable records and NOVA failures never become measured zero", async () => {
  assert.equal((await dmvRecords(dmv, {})).status, "Unavailable");
  assert.equal(
    (await novaHealth(async () => Response.json({}))).status,
    "Unavailable",
  );
  const r = await novaHealth(
    async () =>
      Response.json({
        verified_finals: 0,
        recent_overdue_results: 0,
        calculated_at: "2026-10-26T12:00Z",
      }),
    new Date("2026-10-29T12:00Z"),
  );
  assert.equal(r.finals, 0);
  assert.equal(r.stale, true);
});
