import { db, databaseConfigured } from "./store.mjs";
import { periodRange } from "./core.mjs";
import { ga4, databaseCount, bookings, payments, errors } from "./adapters.mjs";
export async function history(site, range) {
  if (!databaseConfigured())
    return {
      status: "Connect the dedicated database to retain analytics history",
      rows: [],
    };
  try {
    return {
      status: "Daily provider snapshots · no customer records retained",
      rows: await db(
        `command_daily_metrics?site_id=eq.${site.id}&day=gte.${range.start.slice(0, 10)}&day=lt.${range.end.slice(0, 10)}&select=day,metrics,captured_at&order=day.desc&limit=400`,
      ),
    };
  } catch {
    return {
      status: "Analytics archive unavailable; verify migration and permissions",
      rows: [],
    };
  }
}
export async function captureHistory(sites, now = new Date()) {
  // Capture a complete previous UTC day. Upsert is idempotent for scheduler retries.
  const range = periodRange("day", new Date(now.getTime() - 86400000));
  let captured = 0;
  for (let i = 0; i < sites.length; i += 4)
    await Promise.all(
      sites.slice(i, i + 4).map(async (site) => {
        const [traffic, leads, registrations, booking, payment, error] =
          await Promise.all([
            ga4(site, range),
            databaseCount(site, "leads", range),
            databaseCount(site, "registrations", range),
            bookings(site, range),
            payments(site, range),
            errors(site, range),
          ]);
        const metrics = {
          visitors: traffic.visitors,
          pageviews: traffic.pageviews,
          leads,
          registrations,
          bookings: booking,
          payments: payment.count,
          errors: error,
        };
        // Unavailable snapshots are preserved as null with their source/reason, never zeros.
        await db("command_daily_metrics?on_conflict=site_id,day", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            site_id: site.id,
            day: range.start.slice(0, 10),
            metrics,
            captured_at: new Date().toISOString(),
          }),
        });
        captured++;
      }),
    );
  return captured;
}
