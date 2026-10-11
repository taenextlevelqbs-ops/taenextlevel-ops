import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { listSites, saveSite } from "../lib/store.mjs";
import { validateSite } from "../lib/core.mjs";
import { probe } from "../lib/monitor.mjs";
const env = {
  COMMAND_DB_URL: "https://project.supabase.co",
  COMMAND_DB_SERVICE_KEY: "test-only-key",
};
test("registry persists new sites and rehydrates all eight selected repositories without replacing existing metadata", async () => {
  const rows = [];
  const fetcher = async (_url, options) => {
    if (options.method === "POST") {
      const row = JSON.parse(options.body);
      const old = rows.findIndex((r) => r.id === row.id);
      if (old >= 0) rows[old] = row;
      else rows.push(row);
      return new Response(null, { status: 204 });
    }
    return Response.json(rows);
  };
  const site = validateSite({
    id: "new-site",
    name: "New site",
    url: "https://example.com",
    repository: "owner/repo",
  });
  await saveSite(site, false, env, fetcher);
  const registry = await listSites(env, fetcher);
  assert.equal(registry.sites.length, 9);
  assert.equal(
    registry.sites.find((s) => s.id === "new-site").url,
    "https://example.com",
  );
  await assert.rejects(saveSite(site, false, env, fetcher), /already exists/);
  await saveSite({ ...site, name: "Updated site" }, true, env, fetcher);
  assert.equal(
    (await listSites(env, fetcher)).sites.find((s) => s.id === "new-site").name,
    "Updated site",
  );
  await assert.rejects(
    saveSite({ ...site, id: "unknown-site" }, true, env, fetcher),
    /does not exist/,
  );
});
test("registry reports missing or inaccessible storage honestly and never pretends a failed save persisted", async () => {
  assert.equal((await listSites({})).sites.length, 8);
  assert.match(
    (await listSites(env, async () => new Response(null, { status: 403 })))
      .status,
    /unavailable/,
  );
  await assert.rejects(
    saveSite(validateSite({ id: "new-site", name: "New site" }), false, {}),
    /Connect/,
  );
});
function requester(status, location = null, inspect = () => {}) {
  return (url, options, callback) => {
    inspect(url, options);
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = status;
      res.headers = { location };
      res.destroy = () => {};
      callback(res);
    };
    return req;
  };
}
test("uptime probes pin public DNS and record only measured status and latency", async () => {
  let checked = false;
  const result = await probe(
    "https://example.com",
    async () => [{ address: "93.184.216.34", family: 4 }],
    requester(200, null, (_url, options) => {
      options.lookup("example.com", {}, (_err, address) => {
        checked = address === "93.184.216.34";
      });
    }),
  );
  assert.equal(result.status, "up");
  assert.equal(result.httpStatus, 200);
  assert.ok(result.responseMs >= 0);
  assert.ok(checked);
});
test("uptime does not label network denial as downtime and revalidates redirect targets", async () => {
  assert.equal(
    (
      await probe("https://example.com", async () => {
        throw new Error("proxy block");
      })
    ).status,
    "unknown",
  );
  const result = await probe(
    "https://example.com",
    async (host) => [
      {
        address: host === "example.com" ? "93.184.216.34" : "127.0.0.1",
        family: 4,
      },
    ],
    requester(302, "https://private.example.com"),
  );
  assert.equal(result.status, "unknown");
  assert.equal(result.httpStatus, null);
  assert.equal(
    (
      await probe(
        "https://example.com",
        async () => [{ address: "93.184.216.34", family: 4 }],
        requester(503),
      )
    ).status,
    "down",
  );
});
