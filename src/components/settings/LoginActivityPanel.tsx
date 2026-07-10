"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface LoginActivityRow {
  Id: number;
  Username: string;
  IpAddress: string | null;
  UserAgent: string | null;
  Success: boolean;
  FailureReason: string | null;
  CreatedAt: string;
}

export function LoginActivityPanel({ rows }: { rows: LoginActivityRow[] }) {
  const t = useTranslations("settings.loginActivity");
  const columns = [t("columnUser"), t("columnIpAddress"), t("columnResult"), t("columnDetails"), t("columnWhen")];
  return (
    <Card className="flex flex-col gap-3" id="field-login-activity">
      <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h3>
      <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {columns.map((h) => (
                <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.Username}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.IpAddress ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone={r.Success ? "success" : "danger"}>{r.Success ? t("success") : t("failed")}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.FailureReason ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.CreatedAt.replace("T", " ")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                  {t("noActivityRecorded")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
