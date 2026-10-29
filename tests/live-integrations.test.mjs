import test from "node:test";
import assert from "node:assert/strict";
import {
  businessSnapshot,
  nativeBookings,
  nativeDmv,
  publicJobs,
} from "../lib/live-integrations.mjs";
const connection = (items) => ({ status: "Connected", reason: null, items });
test("business reads are signed to their origin and wrong-business responses fail closed", async () => {
  const env = { COACH_TAE_OPS_SECRET: "test-only-secret-".repeat(4) };
  const r = await businessSnapshot("coach-tae", env, async (url, options) => {
    assert.equal(url, "https://coachtaeqb.com/api/command-center");
    assert.match(options.headers.Authorization, /^DCC \d{13}:[a-f0-9]{64}$/);
    return Response.json({
      business: "dmv-attack",
      records: {},
      deployment: {},
    });
  });
  assert.equal(r.status, "Unavailable");
});
test("native schedule excludes expired unpaid holds and preserves imported occupied times", () => {
  const now = Date.parse("2026-10-29T12:00Z");
  const r = nativeBookings(
    {
      status: "Connected",
      collectedAt: new Date(now).toISOString(),
      records: {
        athletes: connection([{ id: "a", name: "Test Athlete" }]),
        slots: connection([
          {
            id: "s",
            starts_at: "2026-11-01T15:00Z",
            ends_at: "2026-11-01T16:00Z",
            kind: "private",
          },
        ]),
        bookings: connection([
          {
            id: "expired",
            slot_id: "s",
            athlete_id: "a",
            status: "held",
            hold_until: "2026-10-28T00:00Z",
          },
          {
            id: "confirmed",
            slot_id: "s",
            athlete_id: "a",
            status: "confirmed",
            paid: true,
          },
        ]),
        legacy: connection([
          {
            id: "legacy",
            reason: "Existing training appointment",
            starts_at: "2026-11-08T14:00Z",
            ends_at: "2026-11-08T15:00Z",
          },
        ]),
      },
    },
    now,
  );
  assert.deepEqual(
    r.items.map((i) => i.id),
    ["confirmed", "legacy"],
  );
  assert.match(r.items[0].title, /confirmed · paid/);
});
test("DMV fee failures do not become zero balances or hide available athletes", () => {
  const r = nativeDmv({
    status: "Connected",
    records: {
      athletes: connection([{ id: "a" }]),
      teams: connection([]),
      fees: { status: "Unavailable", reason: "not installed" },
      transactions: connection([]),
    },
  });
  assert.equal(r.status, "Connected");
  assert.equal(r.items.length, 1);
  assert.equal(r.feesStatus, "Unavailable");
  assert.equal(r.feesReason, "not installed");
});
test("public job API errors remain unavailable instead of a fabricated successful run", async () => {
  const r = await publicJobs(
    "owner/repo",
    async () => new Response("", { status: 429 }),
  );
  assert.equal(r.status, "Unavailable");
  assert.equal(r.measuredAt, null);
});
