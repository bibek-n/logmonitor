import Link from "next/link";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface TicketRow {
  Id: number;
  TicketNumber: string;
  Name: string;
  Email: string;
  Subject: string;
  Category: string;
  Priority: string;
  Status: string;
  CreatedAt: string;
}

const STATUS_TONE: Record<string, "info" | "warning" | "success" | "neutral"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
};

export default async function TicketsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Support Tickets</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can manage support tickets.</p>
      </div>
    );
  }

  const { status, category, priority } = await searchParams;

  const db = await getDb();
  const request = db.request();
  const conditions: string[] = [];
  if (status) {
    request.input("status", sql.VarChar, status);
    conditions.push("Status = @status");
  }
  if (category) {
    request.input("category", sql.NVarChar, category);
    conditions.push("Category = @category");
  }
  if (priority) {
    request.input("priority", sql.VarChar, priority);
    conditions.push("Priority = @priority");
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await request.query<TicketRow>(`
    SELECT Id, TicketNumber, Name, Email, Subject, Category, Priority, Status,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM SupportTickets
    ${where}
    ORDER BY CreatedAt DESC
  `);

  const filterLink = (params: Record<string, string | undefined>) => {
    const merged = { status, category, priority, ...params };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/dashboard/website/tickets?${qs}` : "/dashboard/website/tickets";
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Support Tickets</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Tickets submitted through the public website.
      </p>

      <div className="flex flex-wrap gap-2 mb-4" style={{ fontSize: "0.8rem" }}>
        {["open", "in_progress", "resolved", "closed"].map((s) => (
          <Link
            key={s}
            href={filterLink({ status: status === s ? undefined : s })}
            style={{
              padding: "0.3rem 0.7rem",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: status === s ? "var(--primary)" : "var(--surface-2)",
              color: status === s ? "#fff" : "var(--ink)",
            }}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
        {(status || category || priority) && (
          <Link href="/dashboard/website/tickets" style={{ padding: "0.3rem 0.7rem", color: "var(--ink-muted)" }}>
            Clear filters
          </Link>
        )}
      </div>

      <Card className="flex flex-col gap-0" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["Ticket #", "Subject", "From", "Category", "Priority", "Status", "Created"].map((h) => (
                  <th key={h} style={{ padding: "0.6rem 0.9rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.recordset.map((t) => (
                <tr key={t.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Link href={`/dashboard/website/tickets/${t.Id}`} style={{ color: "var(--primary)" }}>
                      {t.TicketNumber}
                    </Link>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{t.Subject}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    {t.Name}
                    <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>{t.Email}</div>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{t.Category}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{t.Priority}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Badge tone={STATUS_TONE[t.Status] ?? "neutral"}>{t.Status.replace("_", " ")}</Badge>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem", color: "var(--ink-muted)" }}>{t.CreatedAt.replace("T", " ")}</td>
                </tr>
              ))}
              {result.recordset.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    No tickets match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
