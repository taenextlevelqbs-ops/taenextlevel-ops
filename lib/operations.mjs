import {
  businessSnapshot,
  nativeBookings,
  nativeDmv,
  liveHealth,
  liveJobs,
} from "./live-integrations.mjs";
import { verifyPaymentAccount } from "./stripe-account.mjs";
import { jsonRequest, ProviderError, supabaseOrigin } from "./http.mjs";
import { siteEnv } from "./adapters.mjs";

export const businessTools = {
  "coach-tae": [
    ["Coach administration", "https://coachtaeqb.com/coach"],
    ["Training schedule", "https://coachtaeqb.com/coach/schedule"],
  ],
  "dmv-attack": [
    ["Administration", "https://dmvattack.com/admin"],
    ["Tryout registrations", "https://dmvattack.com/admin/tryouts"],
    ["Athletes", "https://dmvattack.com/admin/athletes"],
    ["Team rosters", "https://dmvattack.com/admin/teams"],
    ["Team fees & payments", "https://dmvattack.com/admin/payments"],
    ["Tournaments & events", "https://dmvattack.com/admin/schedule"],
  ],
  nova: [
    ["Score operations", "https://www.novasportslive.com/admin"],
    ["Data health & corrections", "https://www.novasportslive.com/admin/data"],
    ["Football scores", "https://www.novasportslive.com/scores"],
  ],
};
const failed = (reason) => ({
  status: "Unavailable",
  reason,
  items: [],
  measuredAt: null,
});
const connected = (items, extra = {}) => ({
  status: "Connected",
  reason: null,
  items,
  measuredAt: new Date().toISOString(),
  ...extra,
});

export async function upcomingBookings(
  site,
  env = process.env,
  fetcher = fetch,
  now = new Date(),
) {
  const token = siteEnv(site, "CALENDLY_TOKEN", env),
    user = siteEnv(site, "CALENDLY_USER_URI", env);
  if (!token || !user)
    return failed(
      "Calendly read access is not connected. Open the existing schedule below.",
    );
  if (!/^https:\/\/api\.calendly\.com\/users\/[\w-]+$/.test(user))
    return failed("Invalid Calendly user URI");
  try {
    const items = [];
    let cursor = "";
    for (let page = 0; page < 50; page++) {
      const params = new URLSearchParams({
        user,
        status: "active",
        min_start_time: now.toISOString(),
        max_start_time: new Date(+now + 30 * 86400000).toISOString(),
        sort: "start_time:asc",
        count: "100",
      });
      if (cursor) params.set("page_token", cursor);
      const data = await jsonRequest(
        `https://api.calendly.com/scheduled_events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
        fetcher,
      );
      if (!Array.isArray(data.collection))
        throw new ProviderError("Calendly returned incomplete data");
      for (const event of data.collection) {
        if (
          !Number.isFinite(Date.parse(event.start_time)) ||
          !Number.isFinite(Date.parse(event.end_time))
        )
          throw new ProviderError("Calendly returned invalid event times");
        if (event.status === "active" && event.start_time >= now.toISOString())
          items.push({
            id: event.uri,
            title: String(event.name || "Training session").slice(0, 160),
            start: event.start_time,
            end: event.end_time,
            business: site.name,
            source: "Calendly",
            url: businessTools["coach-tae"][0][1],
          });
      }
      cursor = data.pagination?.next_page_token;
      if (!cursor)
        return connected(items.sort((a, b) => a.start.localeCompare(b.start)));
    }
    throw new ProviderError("Calendly results exceeded safe pagination limit");
  } catch (error) {
    return failed(error.message);
  }
}

// Use each business's explicitly scoped key. Never fall back to a shared payment credential.
export async function paymentActivity(
  site,
  env = process.env,
  fetcher = fetch,
) {
  const key = siteEnv(site, "STRIPE_READ_KEY", env);
  if (!key) return failed(`${site.name} Stripe read access is not connected.`);
  const other =
    site.id === "coach-tae"
      ? env.DMV_ATTACK_STRIPE_READ_KEY
      : env.COACH_TAE_STRIPE_READ_KEY;
  if (other && other === key)
    return failed(
      "Payment isolation check failed: businesses must use separate Stripe credentials.",
    );
  try {
    const accountId = await verifyPaymentAccount(site, env, fetcher);
    const data = await jsonRequest(
      "https://api.stripe.com/v1/payment_intents?limit=20",
      { headers: { Authorization: `Bearer ${key}` } },
      fetcher,
    );
    if (!Array.isArray(data.data))
      throw new ProviderError("Stripe returned incomplete payment data");
    return connected(
      data.data.map((p) => {
        if (
          !Number.isSafeInteger(p.amount) ||
          p.amount < 0 ||
          !/^[a-z]{3}$/.test(p.currency) ||
          !Number.isFinite(p.created)
        )
          throw new ProviderError("Stripe returned invalid payment data");
        return {
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          date: new Date(p.created * 1000).toISOString(),
        };
      }),
      { accountId, hasMore: data.has_more === true },
    );
  } catch (error) {
    return failed(error.message);
  }
}

// Explicit field allowlists: no health, guardian contact, evaluations or arbitrary table reads.
export async function dmvRecords(site, env = process.env, fetcher = fetch) {
  const url = siteEnv(site, "SUPABASE_URL", env),
    key = siteEnv(site, "SUPABASE_READ_KEY", env);
  if (!url || !key)
    return failed(
      "DMV database read access is not connected. Manage athletes, rosters and fees in the existing admin panel.",
    );
  try {
    const origin = supabaseOrigin(url);
    const get = async (table, select, orderColumn = "id") => {
      const items = [];
      for (let offset = 0; offset < 50000; offset += 500) {
        const rows = await jsonRequest(
          `${origin}/rest/v1/${table}?${new URLSearchParams({ select, order: `${orderColumn}.asc`, offset: String(offset), limit: "500" })}`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
          fetcher,
        );
        if (!Array.isArray(rows))
          throw new ProviderError("Database returned incomplete records");
        items.push(...rows);
        if (rows.length < 500) return items;
      }
      throw new ProviderError(
        "Database records exceeded safe pagination limit",
      );
    };
    const [athletes, teams, accounts, transactions, registrationPayments] =
      await Promise.all([
        get(
          "tryout_submissions",
          "id,athlete_first_name,athlete_last_name,age_group",
        ),
        get("teams", "id,name,age_group,season,active"),
        get(
          "team_fee_accounts",
          "id,registration_id,team_id,season,fee_cents,discount_cents,due_date",
        ),
        get("team_fee_transactions", "id,account_id,kind,amount_cents"),
        get("tryout_payments", "registration_id,status", "registration_id"),
      ]);
    const fees = accounts.map((a) => {
      if (
        !Number.isSafeInteger(a.fee_cents) ||
        !Number.isSafeInteger(a.discount_cents)
      )
        throw new ProviderError("Invalid fee ledger amount");
      const paid = transactions
        .filter((t) => t.account_id === a.id)
        .reduce((sum, t) => {
          if (
            !Number.isSafeInteger(t.amount_cents) ||
            !["PAYMENT", "REFUND"].includes(t.kind)
          )
            throw new ProviderError("Invalid fee ledger transaction");
          return (
            sum + (t.kind === "PAYMENT" ? t.amount_cents : -t.amount_cents)
          );
        }, 0);
      return {
        ...a,
        outstanding: Math.max(0, a.fee_cents - a.discount_cents - paid),
      };
    });
    return connected(
      athletes.map((a) => ({
        ...a,
        payment_status:
          registrationPayments.find((p) => p.registration_id === a.id)
            ?.status || "Unavailable",
      })),
      { teams, fees },
    );
  } catch (error) {
    return failed(error.message);
  }
}

export async function novaHealth(fetcher = fetch, now = new Date()) {
  try {
    const data = await jsonRequest(
      "https://www.novasportslive.com/api/football/status",
      {},
      fetcher,
    );
    if (
      !Number.isInteger(data.verified_finals) ||
      !Number.isInteger(data.recent_overdue_results) ||
      !Number.isFinite(Date.parse(data.calculated_at))
    )
      throw new ProviderError("NOVA returned incomplete health data");
    return connected([], {
      commit:
        typeof data.commit === "string" && /^[a-f0-9]{40}$/.test(data.commit)
          ? data.commit
          : null,
      throughDate: data.through_date,
      finals: data.verified_finals,
      overdue: data.recent_overdue_results,
      calculatedAt: data.calculated_at,
      stale: +now - Date.parse(data.calculated_at) > 36 * 3600000,
      unresolved: data.unresolved,
      playoff: data.playoff_watch,
      officialSeedsVerified: data.official_playoff_seeds_verified === true,
    });
  } catch (error) {
    return failed(error.message);
  }
}

// Dates are sourced from DMV's existing published 2027 organization schedule.
export const tournaments = [
  ["Duel in the DMV", "2027-02-27", "2027-03-01", "Upper Marlboro, MD"],
  ["Music City Mayhem", "2027-03-13", "2027-03-15", "Murfreesboro, TN"],
  ["Football City Clash", "2027-03-20", "2027-03-22", "Rock Hill, SC"],
  ["Virginia Frenzy", "2027-04-03", "2027-04-05", "Gainesville, VA"],
  ["PA Classic", "2027-04-10", "2027-04-12", "West Bradford Township, PA"],
  [
    "National Championship · qualification required",
    "2027-05-01",
    "2027-05-03",
    "Indianapolis, IN",
  ],
].map(([title, start, end, location]) => ({
  id: start,
  title,
  start,
  end,
  location,
  business: "DMV Attack",
  source: "2027 organization schedule · confirm in admin",
  url: "https://dmvattack.com/admin/schedule",
}));

const livePayments = (snapshot) =>
  snapshot.payments?.status === "Connected" && !snapshot.payments.livemode
    ? failed("Stripe is in test mode; live financial reporting is withheld.")
    : snapshot.payments || failed(snapshot.reason);
export async function loadOperations(sites) {
  const coach = sites.find((s) => s.id === "coach-tae"),
    dmv = sites.find((s) => s.id === "dmv-attack");
  const [coachNative, dmvNative, crestlane, health, jobs, nova] =
    await Promise.all([
      businessSnapshot("coach-tae"),
      businessSnapshot("dmv-attack"),
      businessSnapshot("crestlane"),
      liveHealth(sites),
      liveJobs(sites),
      novaHealth(),
    ]);
  const [bookings, coachPayments, dmvPayments, records] = await Promise.all([
    process.env.COACH_TAE_OPS_SECRET
      ? nativeBookings(coachNative)
      : coach
        ? upcomingBookings(coach)
        : failed("Coach Tae missing"),
    process.env.COACH_TAE_OPS_SECRET
      ? livePayments(coachNative)
      : coach
        ? paymentActivity(coach)
        : failed("Coach Tae missing"),
    process.env.DMV_ATTACK_OPS_SECRET
      ? livePayments(dmvNative)
      : dmv
        ? paymentActivity(dmv)
        : failed("DMV Attack missing"),
    process.env.DMV_ATTACK_OPS_SECRET
      ? nativeDmv(dmvNative)
      : dmv
        ? dmvRecords(dmv)
        : failed("DMV Attack missing"),
  ]);
  return {
    bookings,
    coachPayments,
    dmvPayments,
    records,
    nova,
    coachNative,
    dmvNative,
    crestlane,
    health,
    jobs,
    tournaments: (dmvNative.status === "Connected" && Array.isArray(dmvNative.tournaments) ? dmvNative.tournaments : tournaments).filter(
      (e) => e.end >= new Date().toISOString().slice(0, 10),
    ),
  };
}
