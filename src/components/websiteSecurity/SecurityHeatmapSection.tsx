"use client";

import { useRouter } from "next/navigation";
import { SecurityHeatmap, type HeatmapRow } from "./SecurityHeatmap";

// Thin client wrapper so the server-rendered list page can pass data straight through
// without itself needing "use client" - clicking a website in the heatmap navigates straight
// to its own detail page (/dashboard/audit/website-security/[id]).
export function SecurityHeatmapSection({ rows }: { rows: HeatmapRow[] }) {
  const router = useRouter();
  return (
    <SecurityHeatmap
      rows={rows}
      onSelectWebsite={(id) => {
        router.push(`/dashboard/audit/website-security/${id}`);
      }}
    />
  );
}
