import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_ssl_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const result = await db.query(`
    SELECT m.Id AS MonitorId, m.Name AS MonitorName, s.Domain, s.Issuer, s.Subject,
      CONVERT(VARCHAR(33), s.ValidFrom, 126) AS ValidFrom, CONVERT(VARCHAR(33), s.ExpiresAt, 126) AS ExpiresAt,
      DATEDIFF(DAY, SYSUTCDATETIME(), s.ExpiresAt) AS DaysRemaining,
      s.HostnameMatch, s.ChainValid, s.SelfSigned, s.TlsProtocol, s.SignatureAlgorithm,
      CONVERT(VARCHAR(33), s.LastCheckedAt, 126) AS LastCheckedAt
    FROM SslCertificateRecords s
    JOIN Monitors m ON m.Id = s.MonitorId AND m.IsDeleted = 0
    ORDER BY s.ExpiresAt ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
