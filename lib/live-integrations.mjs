import { createHmac } from "node:crypto";
import { unstable_cache } from "next/cache.js";
import { jsonRequest } from "./http.mjs";
const sources = {
  "coach-tae": ["https://coachtaeqb.com", "COACH_TAE_OPS_SECRET"],
  "dmv-attack": ["https://www.dmvattack.com", "DMV_ATTACK_OPS_SECRET"],
  crestlane: ["https://www.crestlanedigital.com", "CRESTLANE_OPS_SECRET"],
};
export async function businessSnapshot(id, env = process.env, fetcher = fetch) {
  const [origin, key] = sources[id],
    secret = env[key];
  if (!secret)
    return {
      business: id,
      status: "Unavailable",
      reason: `Configure ${key} in the existing Command Center deployment.`,
      records: {},
    };
  try {
    const timestamp = String(Date.now()),
      path = "/api/command-center",
      signature = createHmac("sha256", secret)
        .update(`${origin}\n${path}\n${timestamp}`)
        .digest("hex");
    const data = await jsonRequest(
      origin + path,
      { headers: { Authorization: `DCC ${timestamp}:${signature}` } },
      fetcher,
    );
    if (data.business !== id || !data.records || !data.deployment)
      throw Error("Business identity mismatch");
    return { ...data, status: "Connected", reason: null };
  } catch (e) {
    return {
      business: id,
      status: "Unavailable",
      reason: e.message,
      records: {},
    };
  }
}
const unavailable = (reason) => ({
  status: "Unavailable",
  reason,
  items: [],
  measuredAt: null,
});
export function nativeBookings(snapshot, now = Date.now()) {
  const records = snapshot.records;
  if (snapshot.status !== "Connected") return unavailable(snapshot.reason);
  if (
    records.bookings?.status !== "Connected" ||
    records.slots?.status !== "Connected"
  )
    return unavailable("Native session records are unavailable.");
  const items = [];
  for (const b of records.bookings.items) {
    const s = records.slots.items.find((s) => s.id === b.slot_id),
      a = records.athletes?.items?.find((a) => a.id === b.athlete_id);
    if (
      !s ||
      Date.parse(s.starts_at) < now ||
      Date.parse(s.starts_at) > now + 30 * 86400000 ||
      !["confirmed", "held"].includes(b.status) ||
      (b.status === "held" && Date.parse(b.hold_until) <= now)
    )
      continue;
    items.push({
      id: b.id,
      title: `${a?.name || "Athlete"} · ${s.kind} · ${b.status}${b.paid ? " · paid" : ""}`,
      start: s.starts_at,
      end: s.ends_at,
      business: "Coach Tae",
      source: "Native Supabase booking",
      url: "https://coachtaeqb.com/coach",
    });
  }
  for (const b of records.legacy?.items || [])
    if (
      b.reason === "Existing training appointment" &&
      Date.parse(b.starts_at) >= now &&
      Date.parse(b.starts_at) < now + 30 * 86400000
    )
      items.push({
        id: b.id,
        title: "Preserved existing appointment · occupied time",
        start: b.starts_at,
        end: b.ends_at,
        business: "Coach Tae",
        source: "Protected legacy appointment",
        url: "https://coachtaeqb.com/coach/schedule",
      });
  return {
    status: "Connected",
    reason: null,
    items: items.sort((a, b) => a.start.localeCompare(b.start)),
    measuredAt: snapshot.collectedAt,
  };
}
export function nativeDmv(snapshot) {
  const r = snapshot.records;
  if (snapshot.status !== "Connected") return unavailable(snapshot.reason);
  if (r.athletes?.status !== "Connected" || r.teams?.status !== "Connected")
    return unavailable(
      r.athletes?.reason || r.teams?.reason || "DMV records unavailable",
    );
  const feesStatus =
    r.fees?.status === "Connected" && r.transactions?.status === "Connected"
      ? "Connected"
      : "Unavailable";
  const fees =
    feesStatus === "Connected"
      ? r.fees.items.map((a) => ({
          ...a,
          outstanding: Math.max(
            0,
            a.fee_cents -
              a.discount_cents -
              r.transactions.items
                .filter((t) => t.account_id === a.id)
                .reduce(
                  (sum, t) =>
                    sum +
                    (t.kind === "PAYMENT" ? t.amount_cents : -t.amount_cents),
                  0,
                ),
          ),
        }))
      : [];
  return {
    status: "Connected",
    reason: null,
    measuredAt: snapshot.collectedAt,
    items: r.athletes.items.map((a) => ({
      ...a,
      payment_status:
        r.registrationPayments?.status === "Connected"
          ? r.registrationPayments.items.find((p) => p.registration_id === a.id)
              ?.status || "No recorded payment"
          : "Unavailable",
    })),
    teams: r.teams.items,
    fees,
    feesStatus,
    rosters: r.rosters?.status === "Connected" ? r.rosters.items : [],
    rostersStatus: r.rosters?.status || "Unavailable",
    feesReason: r.fees?.reason || r.transactions?.reason || null,
  };
}
export async function publicJobs(repository, fetcher = fetch) {
  try {
    const data = await jsonRequest(
      `https://api.github.com/repos/${repository}/actions/runs?per_page=30`,
      { headers: { Accept: "application/vnd.github+json" } },
      fetcher,
    );
    if (!Array.isArray(data.workflow_runs))
      throw Error("Incomplete GitHub Actions response");
    return {
      status: "Connected",
      reason: null,
      items: data.workflow_runs.map((r) => ({
        id: String(r.id),
        workflowId: String(r.workflow_id),
        title: r.name,
        state: r.conclusion || r.status,
        url: r.html_url,
        date: r.updated_at,
      })),
      measuredAt: new Date().toISOString(),
    };
  } catch (e) {
    return unavailable(e.message);
  }
}
const cachedJobs = unstable_cache(publicJobs, ["public-business-actions-v1"], {
  revalidate: 300,
});
export async function liveHealth(sites, env = process.env, fetcher = fetch) {
  if (!env.COACH_TAE_OPS_SECRET) return [];
  return Promise.all(
    sites
      .filter(
        (s) =>
          ["coach-tae", "dmv-attack", "nova", "crestlane"].includes(s.id) &&
          s.url,
      )
      .map(async (s) => {
        const start = performance.now();
        try {
          const response = await fetcher(s.url, {
            method: "HEAD",
            cache: "no-store",
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
          });
          return {
            id: s.id,
            status:
              response.status >= 200 && response.status < 400 ? "up" : "down",
            httpStatus: response.status,
            responseMs: Math.round(performance.now() - start),
            checkedAt: new Date().toISOString(),
          };
        } catch {
          return {
            id: s.id,
            status: "unknown",
            httpStatus: null,
            responseMs: null,
            checkedAt: new Date().toISOString(),
          };
        }
      }),
  );
}
export async function liveJobs(sites, env = process.env) {
  if (!env.COACH_TAE_OPS_SECRET) return [];
  return Promise.all(
    sites
      .filter((s) =>
        ["coach-tae", "dmv-attack", "nova", "crestlane"].includes(s.id),
      )
      .map(async (s) => ({ id: s.id, ...(await cachedJobs(s.repository)) })),
  );
}
