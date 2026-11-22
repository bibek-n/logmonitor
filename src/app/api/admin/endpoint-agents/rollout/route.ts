import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Backs the "Agent Rollout" page - approves the agent release each DeviceType should update
// to. AgentRolloutSettings is a singleton row (Id = 1) that was defined in the schema but never
// actually read anywhere: heartbeat/route.ts never populated agentTargetVersion, so
// CheckForUpdate (agent/update.go) was always a no-op for every device, fleet-wide, regardless
// of what version was tagged on GitHub. See the fix in heartbeat/route.ts.
const RELEASE_TAG_PATTERN = /^agent-v\d+\.\d+\.\d+$/;

export interface AgentRolloutData {
  EmployeeTargetVersion: string | null;
  ServerTargetVersion: string | null;
  UpdatedAt: string | null;
}

export interface AgentVersionBucket {
  DeviceType: string;
  AgentVersion: string | null;
  Cnt: number;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const settingsResult = await db.query<AgentRolloutData>`
    SELECT EmployeeTargetVersion, ServerTargetVersion, UpdatedAt FROM AgentRolloutSettings WHERE Id = 1
  `;
  // Adoption snapshot - what's actually running right now, per device type, so an admin can see
  // a rollout take effect instead of approving a version and never finding out if it worked.
  const versionsResult = await db.query<AgentVersionBucket>`
    SELECT DeviceType, AgentVersion, COUNT(*) AS Cnt
    FROM Devices
    GROUP BY DeviceType, AgentVersion
    ORDER BY DeviceType, AgentVersion
  `;

  return NextResponse.json({
    ok: true,
    data: settingsResult.recordset[0] ?? { EmployeeTargetVersion: null, ServerTargetVersion: null, UpdatedAt: null },
    versions: versionsResult.recordset,
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  // Empty string/whitespace clears the rollout for that device type (devices hold at their
  // current version) rather than being rejected - same convention as
  // scripts/set-device-target-version.ts's --clear.
  const version = (v: unknown): string | null => {
    if (typeof v !== "string" || !v.trim()) return null;
    return v.trim();
  };
  const employeeTargetVersion = version(body.employeeTargetVersion);
  const serverTargetVersion = version(body.serverTargetVersion);

  for (const v of [employeeTargetVersion, serverTargetVersion]) {
    if (v !== null && !RELEASE_TAG_PATTERN.test(v)) {
      return NextResponse.json({ ok: false, error: `"${v}" is not a release tag like agent-v0.18.1` }, { status: 400 });
    }
  }

  const db = await getDb();
  await db
    .request()
    .input("employeeTargetVersion", sql.VarChar, employeeTargetVersion)
    .input("serverTargetVersion", sql.VarChar, serverTargetVersion)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      IF EXISTS (SELECT 1 FROM AgentRolloutSettings WHERE Id = 1)
        UPDATE AgentRolloutSettings SET
          EmployeeTargetVersion = @employeeTargetVersion, ServerTargetVersion = @serverTargetVersion,
          UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
        WHERE Id = 1
      ELSE
        INSERT INTO AgentRolloutSettings (Id, EmployeeTargetVersion, ServerTargetVersion, UpdatedAt, UpdatedByUserId)
        VALUES (1, @employeeTargetVersion, @serverTargetVersion, SYSUTCDATETIME(), @updatedByUserId)
    `);

  await logAdminAction({
    admin,
    section: "agent_rollout",
    action: "update",
    req,
    details: `employee=${employeeTargetVersion ?? "(none)"} server=${serverTargetVersion ?? "(none)"}`,
  });

  return NextResponse.json({ ok: true });
}
