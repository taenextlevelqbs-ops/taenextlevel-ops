import { businessSnapshot } from "./live-integrations.mjs";
import { unstable_cache } from "next/cache";
import { periodRange, unavailable } from "./core.mjs";
import {
  ga4,
  github,
  vercel,
  databaseCount,
  bookings,
  payments,
  errors,
} from "./adapters.mjs";
import { history } from "./history.mjs";
import { uptime } from "./monitor.mjs";
import { listSites } from "./store.mjs";
export async function siteDashboard(site, range) {
  const [
    traffic,
    git,
    deployment,
    health,
    error,
    payment,
    lead,
    registration,
    booking,
    archive,
  ] = await Promise.all([
    ga4(site, range),
    github(site, range),
    vercel(site, range),
    uptime(site, range),
    errors(site, range),
    payments(site, range),
    databaseCount(site, "leads", range),
    databaseCount(site, "registrations", range),
    bookings(site, range),
    history(site, range),
  ]);
  let business = null;
  if (
    (site.id === "coach-tae" && process.env.COACH_TAE_OPS_SECRET) ||
    (site.id === "dmv-attack" && process.env.DMV_ATTACK_OPS_SECRET)
  )
    business = await businessSnapshot(site.id);
  if (
    business?.payments?.status === "Connected" &&
    business.payments.livemode
  ) {
    payment.count = {
      value: business.payments.count,
      reason: null,
      source: `Stripe · ${business.payments.accountId}`,
      measuredAt: business.payments.measuredAt,
    };
    payment.amounts = business.payments.amounts;
  }
  return {
    collectedAt: new Date().toISOString(),
    site,
    traffic,
    git,
    deployment,
    health,
    archive,
    metrics: {
      visitors: traffic.visitors,
      pageviews: traffic.pageviews,
      live: traffic.live,
      leads: lead,
      registrations: registration,
      bookings: booking,
      payments: payment.count,
      errors: error,
      buildFailures: git.failures,
    },
    paymentAmounts: payment.amounts,
  };
}
const cachedSiteDashboard = unstable_cache(
  siteDashboard,
  ["command-site-report-v1"],
  { revalidate: 60 },
);
/** @param {string} period @param {string|null} selected */
export async function loadDashboard(period = "month", selected = null) {
  const range = periodRange(period),
    registry = await listSites();
  const sites = selected
    ? registry.sites.filter((s) => s.id === selected)
    : registry.sites;
  const rows = [];
  for (let i = 0; i < sites.length; i += 4)
    rows.push(
      ...(await Promise.all(
        sites.slice(i, i + 4).map((s) => cachedSiteDashboard(s, range)),
      )),
    );
  return {
    rows,
    range,
    registryStatus: registry.status,
    sites: registry.sites,
    refreshedAt: rows.length
      ? rows.map((r) => r.collectedAt).sort()[0]
      : new Date().toISOString(),
  };
}
export const notApplicable = () =>
  unavailable("Not applicable to this website");
