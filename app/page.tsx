import { requireSession } from "@/lib/auth.mjs";
import { loadDashboard } from "@/lib/dashboard.mjs";
import { loadOperations } from "@/lib/operations.mjs";
import { Shell } from "@/components/shell";
import { OperationsView } from "@/components/operations";
import type { DashboardData, OperationsData } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Home() {
  await requireSession();
  const data = await loadDashboard("month");
  const ops = await loadOperations(data.sites);
  return (
    <Shell>
      <OperationsView
        data={data as unknown as DashboardData}
        ops={ops as unknown as OperationsData}
      />
    </Shell>
  );
}
