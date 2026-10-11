import https from "node:https";
import { lookup } from "node:dns/promises";
import { checkPublicUrl } from "./http.mjs";
import { db, databaseConfigured } from "./store.mjs";
import { metric, unavailable } from "./core.mjs";

export async function probe(raw, resolver = lookup, requester = https.request) {
  const start = performance.now();
  let url = raw;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const checked = await checkPublicUrl(url, resolver);
      const addresses = await resolver(checked.hostname, { all: true });
      // Pin the validated DNS result to the TLS request to prevent DNS rebinding.
      const validated = await checkPublicUrl(
        checked.href,
        async () => addresses,
      );
      void validated;
      const address = addresses[0];
      const result = await new Promise((resolve, reject) => {
        const req = requester(
          checked,
          {
            method: "GET",
            headers: {
              "User-Agent": "DigitalCommandCenter/1.0 uptime monitor",
              Accept: "text/html",
            },
            lookup: (_host, options, callback) =>
              options.all
                ? callback(null, [address])
                : callback(null, address.address, address.family),
          },
          (res) => {
            const code = res.statusCode || 0;
            const location = res.headers.location;
            res.destroy();
            resolve({ code, location });
          },
        );
        req.setTimeout(8000, () => req.destroy(new Error("timeout")));
        req.on("error", reject);
        req.end();
      });
      if (result.code >= 300 && result.code < 400 && result.location) {
        url = new URL(result.location, checked).href;
        continue;
      }
      return {
        status: result.code >= 200 && result.code < 400 ? "up" : "down",
        httpStatus: result.code,
        responseMs: Math.round(performance.now() - start),
        checkedAt: new Date().toISOString(),
        reason: null,
      };
    }
    return {
      status: "unknown",
      httpStatus: null,
      responseMs: null,
      checkedAt: new Date().toISOString(),
      reason: "Redirect limit exceeded",
    };
  } catch {
    return {
      status: "unknown",
      httpStatus: null,
      responseMs: null,
      checkedAt: new Date().toISOString(),
      reason:
        "Probe unreachable, blocked, or timed out; downtime not established",
    };
  }
}
export async function uptime(site, range) {
  if (!site.url)
    return {
      status: "unknown",
      reason: "Confirm the public website URL",
      response: unavailable("No URL configured", "Uptime monitor"),
      availability: unavailable("No scheduled samples", "Uptime monitor"),
      samples: 0,
      series: [],
      checkedAt: null,
    };
  if (!databaseConfigured())
    return {
      status: "unknown",
      reason: "Connect database and scheduled monitoring",
      response: unavailable("No monitoring samples", "Uptime monitor"),
      availability: unavailable("No monitoring samples", "Uptime monitor"),
      samples: 0,
      series: [],
      checkedAt: null,
    };
  try {
    const rows = await db(
      `command_uptime?site_id=eq.${site.id}&checked_at=gte.${encodeURIComponent(range.start)}&checked_at=lt.${encodeURIComponent(range.end)}&select=status,response_ms,checked_at&order=checked_at.desc&limit=10000`,
    );
    if (!rows.length)
      return {
        status: "unknown",
        reason: "Waiting for the first scheduled measurement",
        response: unavailable("No scheduled samples", "Uptime monitor"),
        availability: unavailable("No scheduled samples", "Uptime monitor"),
        samples: 0,
        series: [],
        checkedAt: null,
      };
    const measured = rows.filter((r) => ["up", "down"].includes(r.status));
    return {
      status: rows[0].status,
      reason:
        rows[0].status === "unknown"
          ? "Probe could not determine availability"
          : null,
      response:
        rows[0].response_ms === null
          ? unavailable(
              "Last probe did not measure response time",
              "Uptime monitor",
            )
          : metric(rows[0].response_ms, "HTTP response time", {
              measuredAt: rows[0].checked_at,
            }),
      availability: measured.length
        ? metric(
            (measured.filter((r) => r.status === "up").length /
              measured.length) *
              100,
            "Successful scheduled samples",
            { measuredAt: rows[0].checked_at },
          )
        : unavailable("All probe results are unknown", "Uptime monitor"),
      samples: measured.length,
      unknownSamples: rows.length - measured.length,
      truncated: rows.length === 10000,
      checkedAt: rows[0].checked_at,
      series: rows.slice(0, 100).reverse(),
    };
  } catch {
    return {
      status: "unknown",
      reason: "Monitoring database unavailable",
      response: unavailable(
        "Monitoring database unavailable",
        "Uptime monitor",
      ),
      availability: unavailable(
        "Monitoring database unavailable",
        "Uptime monitor",
      ),
      samples: 0,
      series: [],
      checkedAt: null,
    };
  }
}
export async function recordProbes(sites) {
  if (!databaseConfigured())
    throw new Error("Monitoring database is not configured");
  const results = [];
  for (let i = 0; i < sites.length; i += 4) {
    const batch = await Promise.all(
      sites
        .slice(i, i + 4)
        .filter((s) => s.url)
        .map(async (site) => {
          const result = await probe(site.url);
          await db("command_uptime", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              site_id: site.id,
              status: result.status,
              http_status: result.httpStatus,
              response_ms: result.responseMs,
              checked_at: result.checkedAt,
            }),
          });
          return { id: site.id, ...result };
        }),
    );
    results.push(...batch);
  }
  return results;
}
