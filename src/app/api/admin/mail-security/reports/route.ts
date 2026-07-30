import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

export async function GET() {
  const mail = await requireMailPolicyPermission("mail_view_incidents");
  if (!isMailSession(mail)) return mail;

  const db = await getDb();

  const [totals, byDirection, topExtensions, topCloudProviders, topSenderDomains, policyTrends] = await Promise.all([
    db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM MailSecurityIncidents"),
    db.query<{ Direction: string; ActionTaken: string; Cnt: number }>(
      "SELECT Direction, ActionTaken, COUNT(*) AS Cnt FROM MailSecurityIncidents GROUP BY Direction, ActionTaken"
    ),
    db.query<{ DeclaredExtension: string | null; Cnt: number }>(
      "SELECT DeclaredExtension, COUNT(*) AS Cnt FROM MailIncidentAttachments WHERE Blocked = 1 GROUP BY DeclaredExtension ORDER BY COUNT(*) DESC"
    ),
    db.query<{ CloudProvider: string | null; Cnt: number }>(
      "SELECT CloudProvider, COUNT(*) AS Cnt FROM MailIncidentUrls WHERE Blocked = 1 AND CloudProvider IS NOT NULL GROUP BY CloudProvider ORDER BY COUNT(*) DESC"
    ),
    db.query<{ Domain: string; Cnt: number }>(
      "SELECT RIGHT(Sender, LEN(Sender) - CHARINDEX('@', Sender)) AS Domain, COUNT(*) AS Cnt FROM MailSecurityIncidents WHERE ActionTaken <> 'Allow' AND CHARINDEX('@', Sender) > 0 GROUP BY RIGHT(Sender, LEN(Sender) - CHARINDEX('@', Sender)) ORDER BY COUNT(*) DESC"
    ),
    db.query<{ PolicyName: string; Cnt: number }>(
      "SELECT p.Name AS PolicyName, COUNT(*) AS Cnt FROM MailSecurityIncidents i JOIN MailBlockingPolicies p ON p.Id = i.MatchedPolicyId GROUP BY p.Name ORDER BY COUNT(*) DESC"
    ),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      totalIncidents: totals.recordset[0].Total,
      byDirectionAndAction: byDirection.recordset,
      topBlockedFileTypes: topExtensions.recordset,
      topBlockedCloudProviders: topCloudProviders.recordset,
      topSenderDomains: topSenderDomains.recordset,
      policyMatchTrends: policyTrends.recordset,
      note: "All figures come from Test Policy simulations in Stage 1 - there is no live provider connected yet, so these do not reflect real mail traffic.",
    },
  });
}
