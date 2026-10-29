import { verifyPaymentAccount } from "./stripe-account.mjs";
import { GoogleAuth } from "google-auth-library";
import { jsonRequest, ProviderError, supabaseOrigin } from "./http.mjs";
import { unavailable, metric, change } from "./core.mjs";

export function siteEnv(site, key, env = process.env) {
  return env[`${site.envPrefix}_${key}`];
}
export async function github(site, range, env = process.env, fetcher = fetch) {
  const token = env.COMMAND_GITHUB_TOKEN || env.GH_TOKEN;
  if (!site.repository)
    return {
      status: "No repository configured",
      activity: [],
      failures: unavailable("No repository configured", "GitHub"),
    };
  if (!token)
    return {
      status: "Connect GitHub read access",
      activity: [],
      failures: unavailable(
        "Connect COMMAND_GITHUB_TOKEN with repository read and Actions read permissions",
        "GitHub",
      ),
    };
  try {
    const base = `https://api.github.com/repos/${site.repository}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const [commits, runs, failures] = await Promise.all([
      jsonRequest(
        `${base}/commits?per_page=8&since=${range.start}&until=${range.end}`,
        { headers },
        fetcher,
      ),
      jsonRequest(`${base}/actions/runs?per_page=5`, { headers }, fetcher),
      jsonRequest(
        `${base}/actions/runs?status=failure&per_page=1&created=${encodeURIComponent(`${range.start.slice(0, 10)}..${new Date(new Date(range.end) - 1).toISOString().slice(0, 10)}`)}`,
        { headers },
        fetcher,
      ),
    ]);
    if (
      !Array.isArray(commits) ||
      !Array.isArray(runs.workflow_runs) ||
      !Number.isInteger(failures.total_count)
    )
      throw new ProviderError("GitHub returned incomplete data");
    return {
      status: "Connected",
      failures: metric(failures.total_count, "GitHub Actions"),
      activity: commits.map((c) => ({
        title: c.commit.message.split("\n")[0].slice(0, 120),
        date: c.commit.committer.date,
        url: c.html_url,
        kind: "commit",
      })),
      runs: runs.workflow_runs.map((r) => ({
        title: r.name,
        state: r.conclusion || r.status,
        url: r.html_url,
        date: r.created_at,
      })),
    };
  } catch (e) {
    return {
      status: e.message,
      activity: [],
      failures: unavailable(e.message, "GitHub"),
    };
  }
}
export async function vercel(site, range, env = process.env, fetcher = fetch) {
  if (!env.COMMAND_VERCEL_TOKEN || !site.vercelProject)
    return { status: "Connect a Vercel project", deployments: [] };
  try {
    const params = new URLSearchParams({
      projectId: site.vercelProject,
      limit: "8",
      since: String(Date.parse(range.start)),
      until: String(Date.parse(range.end)),
    });
    if (env.COMMAND_VERCEL_TEAM_ID)
      params.set("teamId", env.COMMAND_VERCEL_TEAM_ID);
    const data = await jsonRequest(
      `https://api.vercel.com/v6/deployments?${params}`,
      { headers: { Authorization: `Bearer ${env.COMMAND_VERCEL_TOKEN}` } },
      fetcher,
    );
    if (!Array.isArray(data.deployments))
      throw new ProviderError("Vercel returned incomplete data");
    return {
      status: "Connected",
      deployments: data.deployments.map((d) => ({
        id: d.uid,
        state: d.readyState || d.state,
        date: new Date(d.created).toISOString(),
        url: `https://${d.url}`,
        target: d.target || "preview",
      })),
    };
  } catch (e) {
    return { status: e.message, deployments: [] };
  }
}
function reportDate(iso, minus = 0) {
  return new Date(Date.parse(iso) - minus).toISOString().slice(0, 10);
}
export async function ga4(
  site,
  range,
  env = process.env,
  fetcher = fetch,
  tokenProvider = null,
) {
  const empty = {
    visitors: unavailable(
      "Connect a GA4 property and Google service account",
      "Google Analytics",
    ),
    pageviews: unavailable(
      "Connect a GA4 property and Google service account",
      "Google Analytics",
    ),
    live: unavailable("GA4 realtime is not connected", "Google Analytics"),
    series: [],
    topPages: [],
    sources: [],
    devices: [],
    status: "Not connected",
  };
  if (!site.ga4Property || !env.GOOGLE_SERVICE_ACCOUNT_JSON) return empty;
  try {
    let token;
    if (tokenProvider) token = await tokenProvider();
    else {
      const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (credentials.type !== "service_account")
        throw new ProviderError("Use a Google service-account credential file");
      if (
        credentials.token_uri &&
        credentials.token_uri !== "https://oauth2.googleapis.com/token"
      )
        throw new ProviderError("Unsupported Google token endpoint");
      const auth = new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      });
      token = await auth.getAccessToken();
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const base = `https://analyticsdata.googleapis.com/v1beta/properties/${site.ga4Property}`;
    const dateRanges = [
      { startDate: reportDate(range.start), endDate: reportDate(range.end, 1) },
    ];
    const report = (body) =>
      jsonRequest(
        `${base}:runReport`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ dateRanges, ...body }),
        },
        fetcher,
      );
    const [totals, previous, series, pages, sources, devices] =
      await Promise.all([
        report({
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        }),
        report({
          dateRanges: [
            {
              startDate: reportDate(range.previousStart),
              endDate: reportDate(range.previousEnd, 1),
            },
          ],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        }),
        report({
          dimensions: [{ name: "date" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: 400,
        }),
        report({
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 6,
        }),
        report({
          dimensions: [{ name: "sessionSourceMedium" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 6,
        }),
        report({
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "activeUsers" }],
        }),
      ]);
    const total = (r, i) => {
      if (!Array.isArray(r.metricHeaders) || !r.metricHeaders[i])
        throw new ProviderError("Analytics returned incomplete data");
      if (r.rows?.length) {
        const value = Number(r.rows[0]?.metricValues?.[i]?.value);
        if (!Number.isFinite(value) || value < 0)
          throw new ProviderError("Analytics returned an invalid count");
        return value;
      }
      if (r.rowCount === undefined || Number(r.rowCount) === 0) return 0;
      throw new ProviderError("Analytics returned incomplete data");
    };
    const a = total(totals, 0),
      b = total(totals, 1),
      pa = total(previous, 0),
      pb = total(previous, 1);
    const breakdown = (r) =>
      (r.rows || []).map((row) => ({
        label: row.dimensionValues[0].value,
        value: Number(row.metricValues[0].value),
      }));
    let live = empty.live;
    try {
      const rt = await jsonRequest(
        `${base}:runRealtimeReport`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ metrics: [{ name: "activeUsers" }] }),
        },
        fetcher,
      );
      live = metric(total(rt, 0), "GA4 · last 30 minutes");
    } catch (e) {
      live = unavailable(e.message, "GA4 realtime");
    }
    const byDate = new Map(
      (series.rows || []).map((row) => [
        row.dimensionValues[0].value,
        {
          views: Number(row.metricValues[0].value),
          visitors: Number(row.metricValues[1].value),
        },
      ]),
    );
    const points = [];
    for (
      let t = Date.parse(range.start);
      t < Date.parse(range.end);
      t += 86400000
    ) {
      const date = new Date(t).toISOString().slice(0, 10);
      const values = byDate.get(date.replaceAll("-", "")) || {
        views: 0,
        visitors: 0,
      };
      points.push({ date, ...values });
    }
    return {
      visitors: metric(a, "GA4 active users", {
        previous: pa,
        change: change(a, pa),
      }),
      pageviews: metric(b, "GA4 page views", {
        previous: pb,
        change: change(b, pb),
      }),
      live,
      series: points,
      topPages: breakdown(pages),
      sources: breakdown(sources),
      devices: breakdown(devices),
      status: "Connected",
    };
  } catch (e) {
    const reason =
      e instanceof ProviderError
        ? e.message
        : "Google service account configuration is invalid";
    return {
      ...empty,
      status: reason,
      visitors: unavailable(reason, "GA4"),
      pageviews: unavailable(reason, "GA4"),
    };
  }
}
export async function databaseCount(
  site,
  key,
  range,
  env = process.env,
  fetcher = fetch,
) {
  const defaults = {
    "dmv-attack": { registrations: "tryout_submissions" },
    bellewood: { leads: "pharmacy_requests" },
    nova: { registrations: "score_updates" },
  };
  const table =
    siteEnv(site, `${key.toUpperCase()}_TABLE`, env) ||
    defaults[site.id]?.[key];
  const url = siteEnv(site, "SUPABASE_URL", env),
    token = siteEnv(site, "SUPABASE_READ_KEY", env);
  if (!table || !url || !token)
    return unavailable(
      "Connect a read-only aggregate view in the existing database",
      "Supabase",
    );
  try {
    if (!/^[a-z_][a-z0-9_]*$/.test(table))
      throw new ProviderError("Invalid aggregate table configuration");
    const column = siteEnv(site, "TIMESTAMP_COLUMN", env) || "created_at";
    if (!/^[a-z_][a-z0-9_]*$/.test(column))
      throw new ProviderError("Invalid timestamp column");
    const params = new URLSearchParams({
      select: "id",
      and: `(${column}.gte.${range.start},${column}.lt.${range.end})`,
    });
    const response = await fetcher(
      `${supabaseOrigin(url)}/rest/v1/${table}?${params}`,
      {
        method: "HEAD",
        headers: {
          apikey: token,
          Authorization: `Bearer ${token}`,
          Prefer: "count=exact",
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok)
      throw new ProviderError(
        `Database count unavailable (HTTP ${response.status})`,
      );
    const count = response.headers.get("content-range")?.split("/")[1];
    if (!count || !/^\d+$/.test(count))
      throw new ProviderError("Database did not return an exact count");
    return metric(Number(count), "Supabase · aggregate count only");
  } catch (e) {
    return unavailable(
      e instanceof ProviderError ? e.message : "Database unreachable",
      "Supabase",
    );
  }
}
export async function bookings(
  site,
  range,
  env = process.env,
  fetcher = fetch,
) {
  const token = siteEnv(site, "CALENDLY_TOKEN", env),
    user = siteEnv(site, "CALENDLY_USER_URI", env);
  if (!token || !user)
    return unavailable("Connect Calendly account read access", "Calendly");
  try {
    if (!/^https:\/\/api\.calendly\.com\/users\/[\w-]+$/.test(user))
      throw new ProviderError("Invalid Calendly user URI");
    let pageToken = "",
      count = 0;
    for (let page = 0; page < 50; page++) {
      const params = new URLSearchParams({
        user,
        status: "active",
        min_start_time: range.start,
        max_start_time: range.end,
        count: "100",
      });
      if (pageToken) params.set("page_token", pageToken);
      const data = await jsonRequest(
        `https://api.calendly.com/scheduled_events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
        fetcher,
      );
      if (!Array.isArray(data.collection))
        throw new ProviderError("Calendly returned incomplete data");
      count += data.collection.filter(
        (e) => e.start_time >= range.start && e.start_time < range.end,
      ).length;
      pageToken = data.pagination?.next_page_token;
      if (!pageToken)
        return metric(count, "Calendly · scheduled events, not attendee count");
    }
    return unavailable(
      "Booking results exceeded safe pagination limit",
      "Calendly",
    );
  } catch (e) {
    return unavailable(e.message, "Calendly");
  }
}
export async function payments(
  site,
  range,
  env = process.env,
  fetcher = fetch,
) {
  const token = siteEnv(site, "STRIPE_READ_KEY", env);
  if (!token)
    return {
      count: unavailable("Connect a Stripe restricted read key", "Stripe"),
      amounts: [],
    };
  try {
    await verifyPaymentAccount(site, env, fetcher);
    let cursor = "",
      count = 0;
    const amounts = new Map();
    for (let page = 0; page < 50; page++) {
      const p = new URLSearchParams({
        limit: "100",
        "created[gte]": String(Date.parse(range.start) / 1000),
        "created[lt]": String(Date.parse(range.end) / 1000),
      });
      if (cursor) p.set("starting_after", cursor);
      const data = await jsonRequest(
        `https://api.stripe.com/v1/charges?${p}`,
        { headers: { Authorization: `Bearer ${token}` } },
        fetcher,
      );
      if (!Array.isArray(data.data) || typeof data.has_more !== "boolean")
        throw new ProviderError("Stripe returned incomplete data");
      for (const c of data.data)
        if (c.paid && c.status === "succeeded" && c.captured) {
          count++;
          amounts.set(
            c.currency,
            (amounts.get(c.currency) || 0) + c.amount - c.amount_refunded,
          );
        }
      if (!data.has_more)
        return {
          count: metric(count, "Stripe · captured payments"),
          amounts: [...amounts].map(([currency, minorUnits]) => ({
            currency,
            minorUnits,
          })),
        };
      if (!data.data.length)
        throw new ProviderError("Stripe pagination is inconsistent");
      cursor = data.data.at(-1).id;
    }
    return {
      count: unavailable(
        "Payment results exceeded safe pagination limit",
        "Stripe",
      ),
      amounts: [],
    };
  } catch (e) {
    return { count: unavailable(e.message, "Stripe"), amounts: [] };
  }
}
export async function errors(site, range, env = process.env, fetcher = fetch) {
  if (!env.COMMAND_SENTRY_TOKEN || !site.sentryProject)
    return unavailable("Connect a Sentry project", "Sentry");
  try {
    const params = new URLSearchParams({
      stat: "received",
      since: String(Date.parse(range.start) / 1000),
      until: String(Date.parse(range.end) / 1000),
      resolution: "1d",
    });
    const rows = await jsonRequest(
      `https://sentry.io/api/0/projects/${site.sentryProject}/stats/?${params}`,
      { headers: { Authorization: `Bearer ${env.COMMAND_SENTRY_TOKEN}` } },
      fetcher,
    );
    if (
      !Array.isArray(rows) ||
      rows.some((r) => !Array.isArray(r) || !Number.isFinite(r[1]))
    )
      throw new ProviderError("Sentry returned incomplete data");
    return metric(
      rows.reduce((sum, r) => sum + r[1], 0),
      "Sentry · received error events",
    );
  } catch (e) {
    return unavailable(e.message, "Sentry");
  }
}
