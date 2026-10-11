import test from "node:test";
import assert from "node:assert/strict";
import {
  ga4,
  databaseCount,
  github,
  vercel,
  bookings,
  payments,
  errors,
} from "../lib/adapters.mjs";
import { periodRange } from "../lib/core.mjs";
const site = {
  id: "dmv-attack",
  envPrefix: "DMV_ATTACK",
  ga4Property: "123",
  repository: "owner/repo",
  vercelProject: "prj_test",
  sentryProject: "org/project",
};
const range = periodRange("week", new Date("2026-10-11T10:00:00Z"));
const response = (data) => Response.json(data);
test("all unconnected adapters report null metrics rather than synthetic zeros", async () => {
  const r = await ga4(site, range, {});
  assert.equal(r.visitors.value, null);
  assert.equal(
    (await databaseCount(site, "registrations", range, {})).value,
    null,
  );
  assert.equal((await bookings(site, range, {})).value, null);
  assert.equal((await payments(site, range, {})).count.value, null);
  assert.equal((await errors(site, range, {})).value, null);
  assert.equal((await github(site, range, {})).failures.value, null);
});
test("GA4 maps totals, prior comparisons, zero-filled dates and realtime separately", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    const b = JSON.parse(options.body);
    if (url.endsWith(":runRealtimeReport"))
      return response({
        metricHeaders: [{ name: "activeUsers" }],
        rows: [{ metricValues: [{ value: "2" }] }],
      });
    if (!b.dimensions)
      return response({
        metricHeaders: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        rows: [
          {
            metricValues: [
              {
                value:
                  b.dateRanges[0].startDate === range.start.slice(0, 10)
                    ? "20"
                    : "10",
              },
              { value: "100" },
            ],
          },
        ],
      });
    if (b.dimensions[0].name === "date")
      return response({
        rows: [
          {
            dimensionValues: [
              { value: range.start.slice(0, 10).replaceAll("-", "") },
            ],
            metricValues: [{ value: "100" }, { value: "20" }],
          },
        ],
      });
    return response({
      rows: [
        {
          dimensionValues: [{ value: "desktop" }],
          metricValues: [{ value: "20" }],
        },
      ],
    });
  };
  const r = await ga4(
    site,
    range,
    { GOOGLE_SERVICE_ACCOUNT_JSON: "{}" },
    fetcher,
    async () => "mock-test-token",
  );
  assert.equal(r.visitors.value, 20);
  assert.equal(r.visitors.change, 100);
  assert.equal(r.live.value, 2);
  assert.equal(r.series.length, 7);
  assert.equal(
    r.series.reduce((s, p) => s + p.views, 0),
    100,
  );
  assert.equal(r.devices[0].label, "desktop");
  assert.equal(calls.length, 7);
});
test("GA4 failed or malformed responses do not fabricate measured traffic", async () => {
  const r = await ga4(
    site,
    range,
    { GOOGLE_SERVICE_ACCOUNT_JSON: "{}" },
    async () => new Response(null, { status: 403 }),
    async () => "mock-test-token",
  );
  assert.equal(r.visitors.value, null);
  assert.match(r.status, /Access denied/);
});
test("GA4 rejects incomplete successful responses instead of inventing zero traffic", async () => {
  const r = await ga4(
    site,
    range,
    { GOOGLE_SERVICE_ACCOUNT_JSON: "{}" },
    async () => response({}),
    async () => "mock-test-token",
  );
  assert.equal(r.visitors.value, null);
  assert.match(r.status, /incomplete/);
});
test("database connectors use HEAD exact counts with no patient payloads or records", async () => {
  let call;
  const r = await databaseCount(
    site,
    "registrations",
    range,
    {
      DMV_ATTACK_SUPABASE_URL: "https://project.supabase.co",
      DMV_ATTACK_SUPABASE_READ_KEY: "test-key",
    },
    async (url, options) => {
      call = { url, options };
      return new Response(null, { headers: { "content-range": "*/12" } });
    },
  );
  assert.equal(r.value, 12);
  assert.equal(call.options.method, "HEAD");
  assert.match(call.url, /tryout_submissions/);
  assert.match(decodeURIComponent(call.url), /created_at.gte/);
  assert.equal(call.options.body, undefined);
});
test("database count failures and absent exact-count headers remain unavailable", async () => {
  const env = {
    DMV_ATTACK_SUPABASE_URL: "https://project.supabase.co",
    DMV_ATTACK_SUPABASE_READ_KEY: "test-key",
  };
  assert.equal(
    (
      await databaseCount(
        site,
        "registrations",
        range,
        env,
        async () => new Response(null),
      )
    ).value,
    null,
  );
  assert.equal(
    (
      await databaseCount(
        site,
        "registrations",
        range,
        env,
        async () => new Response(null, { status: 401 }),
      )
    ).value,
    null,
  );
});
test("GitHub uses real scoped responses and treats empty repositories as unavailable", async () => {
  const data = await github(
    site,
    range,
    { COMMAND_GITHUB_TOKEN: "test-key" },
    async (url) =>
      url.includes("/commits?")
        ? response([
            {
              commit: {
                message: "A real change\nBody",
                committer: { date: range.start },
              },
              html_url: "https://github.com/owner/repo/commit/1",
            },
          ])
        : url.includes("status=failure")
          ? response({ total_count: 3 })
          : response({ workflow_runs: [] }),
  );
  assert.equal(data.failures.value, 3);
  assert.equal(data.activity[0].title, "A real change");
  const denied = await github(
    site,
    range,
    { COMMAND_GITHUB_TOKEN: "test-key" },
    async () => new Response(null, { status: 403 }),
  );
  assert.equal(denied.failures.value, null);
});
test("Vercel reports real deployment states without claiming an absent deployment succeeded", async () => {
  const data = await vercel(
    site,
    range,
    { COMMAND_VERCEL_TOKEN: "test-key" },
    async () =>
      response({
        deployments: [
          {
            uid: "d",
            readyState: "ERROR",
            created: 1,
            url: "project.vercel.app",
            target: "production",
          },
        ],
      }),
  );
  assert.equal(data.deployments[0].state, "ERROR");
  assert.equal(
    (
      await vercel(
        site,
        range,
        { COMMAND_VERCEL_TOKEN: "test-key" },
        async () => response({ deployments: [] }),
      )
    ).deployments.length,
    0,
  );
});
test("Calendly walks pagination and excludes boundary events from the next period", async () => {
  let calls = 0;
  const env = {
    DMV_ATTACK_CALENDLY_TOKEN: "test-key",
    DMV_ATTACK_CALENDLY_USER_URI: "https://api.calendly.com/users/user-test",
  };
  const r = await bookings(site, range, env, async () => {
    calls++;
    return response({
      collection: [{ start_time: calls === 1 ? range.start : range.end }],
      pagination: { next_page_token: calls === 1 ? "next" : null },
    });
  });
  assert.equal(calls, 2);
  assert.equal(r.value, 1);
});
test("Stripe sums only captured successful payments, separates currencies and subtracts refunds", async () => {
  let calls = 0;
  const r = await payments(
    site,
    range,
    { DMV_ATTACK_STRIPE_READ_KEY: "test-key" },
    async () => {
      calls++;
      return response({
        data: [
          {
            id: "charge" + calls,
            status: "succeeded",
            paid: true,
            captured: true,
            currency: calls === 1 ? "usd" : "eur",
            amount: 1200,
            amount_refunded: 200,
          },
          {
            id: "failed",
            status: "failed",
            paid: false,
            captured: false,
            currency: "usd",
            amount: 999999,
            amount_refunded: 0,
          },
        ],
        has_more: calls === 1,
      });
    },
  );
  assert.equal(r.count.value, 2);
  assert.deepEqual(r.amounts, [
    { currency: "usd", minorUnits: 1000 },
    { currency: "eur", minorUnits: 1000 },
  ]);
});
test("Sentry counts received errors and reports an outage as unavailable", async () => {
  assert.equal(
    (
      await errors(
        site,
        range,
        { COMMAND_SENTRY_TOKEN: "test-key" },
        async () =>
          response([
            [1, 3],
            [2, 4],
          ]),
      )
    ).value,
    7,
  );
  assert.equal(
    (
      await errors(
        site,
        range,
        { COMMAND_SENTRY_TOKEN: "test-key" },
        async () => new Response(null, { status: 500 }),
      )
    ).value,
    null,
  );
});
