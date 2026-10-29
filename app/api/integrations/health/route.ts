import { createHmac, timingSafeEqual } from "node:crypto";
import { loadOperations } from "@/lib/operations.mjs";
import { listSites, db } from "@/lib/store.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const u = new URL(request.url),
    secret = process.env.COMMAND_PROBE_SECRET,
    t = u.searchParams.get("timestamp") || "",
    sig = u.searchParams.get("signature") || "";
  if (
    !secret ||
    secret.length < 32 ||
    !/^\d{13}$/.test(t) ||
    Math.abs(Date.now() - Number(t)) > 60000 ||
    !/^[a-f0-9]{64}$/.test(sig)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const expected = createHmac("sha256", secret)
    .update(`${u.origin}\n${u.pathname}\n${t}`)
    .digest("hex");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const registry = await listSites();
  let database = "Unavailable";
  try {
    await db("command_sites?select=id&limit=1");
    database = "Connected";
  } catch {}
  const ops = await loadOperations(registry.sites);
  const summary = (r: {
    status: string;
    reason?: string | null;
    items?: unknown[];
  }) => ({
    status: r.status,
    reason: r.reason,
    count: r.status === "Connected" ? r.items?.length : null,
  });
  const recordSummary = (b: typeof ops.coachNative) => ({
    status: b.status,
    reason: b.reason,
    deployment: b.deployment,
    records: Object.fromEntries(
      Object.entries(b.records).map(([k, v]) => [
        k,
        summary(v as { status: string; reason?: string; items?: unknown[] }),
      ]),
    ),
    payments: b.payments
      ? {
          ...summary(b.payments),
          accountId: b.payments.accountId,
          livemode: b.payments.livemode,
          amounts: b.payments.amounts,
        }
      : null,
  });
  return Response.json(
    {
      database,
      registry: registry.status,
      auth: {
        ownerConfigured: !!process.env.COMMAND_OWNER_USER_ID,
        anonConfigured: !!process.env.COMMAND_DB_ANON_KEY,
      },
      coach: recordSummary(ops.coachNative),
      dmv: recordSummary(ops.dmvNative),
      crestlane: recordSummary(ops.crestlane),
      bookings: summary(ops.bookings),
      nova: summary(ops.nova),
      health: ops.health,
      jobs: ops.jobs.map((r) => ({ id: r.id, ...summary(r) })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
