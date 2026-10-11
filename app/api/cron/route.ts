import { timingSafeEqual } from "node:crypto";
import { listSites } from "@/lib/store.mjs";
import { captureHistory } from "@/lib/history.mjs";
import { recordProbes } from "@/lib/monitor.mjs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET,
    header = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !header)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(header);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const registry = await listSites();
    if (registry.status.includes("unavailable"))
      throw new Error("Registry unavailable");
    const results = await recordProbes(registry.sites);
    const archived = await captureHistory(registry.sites);
    return Response.json({ ok: true, measured: results.length, archived });
  } catch {
    return Response.json(
      {
        error:
          "Scheduled monitoring failed; inspect database and network configuration.",
      },
      { status: 503 },
    );
  }
}
