import { Skeleton } from "@/components/ui/Skeleton";

// Shown automatically by Next.js inside <main className="dash-content"> (see
// dashboard/layout.tsx) while a page's server data is still loading - the sidebar/header stay
// mounted throughout since only this content area is swapped. Without this, most dashboard
// pages (nearly all of them are `dynamic = "force-dynamic"`, so every navigation re-fetches
// on the server) rendered nothing at all until fully ready, then popped the whole page in at
// once - reading as a jarring "full refresh" even though it was always a normal client-side
// navigation. This is a generic skeleton (not page-specific), since it has to work as a
// reasonable placeholder for every route under /dashboard.
export default function DashboardLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Skeleton width={220} height={22} />
        <Skeleton width={340} height={13} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-panel" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Skeleton width={90} height={12} />
            <Skeleton width={60} height={22} />
          </div>
        ))}
      </div>

      <div className="dash-panel" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Skeleton width={160} height={16} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={14} />
        ))}
      </div>
    </div>
  );
}
