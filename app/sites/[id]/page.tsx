import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth.mjs";
import { loadDashboard } from "@/lib/dashboard.mjs";
import { Shell } from "@/components/shell";
import { Detail } from "@/components/dashboard";
import type { DashboardData } from "@/lib/types";
export default async function Site({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const search = await searchParams;
  const data = await loadDashboard(search.period, id);
  if (!data.rows.length) notFound();
  return (
    <Shell active="sites">
      <Detail data={data as unknown as DashboardData} />
    </Shell>
  );
}
