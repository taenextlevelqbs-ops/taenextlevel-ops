import { requireSession } from "@/lib/auth.mjs";
import { loadDashboard } from "@/lib/dashboard.mjs";
import { Shell } from "@/components/shell";
import { Dashboard } from "@/components/dashboard";
import type { DashboardData } from "@/lib/types";
export default async function Sites({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const data = await loadDashboard(params.period);
  return (
    <Shell active="sites">
      <Dashboard data={data as unknown as DashboardData} portfolio />
    </Shell>
  );
}
