import { NextResponse } from "next/server";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { runDisableAll } from "@/lib/offboarding/offboardingService";

// Idempotent/retry-safe by design (see offboardingService.ts) - clicking this again after a
// partial failure only re-attempts the system(s) that didn't already succeed, never re-blocks
// an already-blocked GitLab user or generates a redundant Glesys password reset.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await requireOffboardingPermission("off_execute");
  if (!isOffboardingSession(off)) return off;

  const { id } = await params;
  try {
    const action = await runDisableAll(Number(id), off.userId, off.username);
    return NextResponse.json({
      ok: true,
      data: {
        actionId: action.id,
        gitlabStatus: action.gitlabStatus,
        gitlabDetail: action.gitlabDetail,
        glesysStatus: action.glesysStatus,
        glesysDetail: action.glesysDetail,
        agentQaStatus: action.agentQaStatus,
        agentQaDetail: action.agentQaDetail,
        teamworkStatus: action.teamworkStatus,
        teamworkDetail: action.teamworkDetail,
        logMonitorStatus: action.logMonitorStatus,
        logMonitorDetail: action.logMonitorDetail,
        activeDirectoryStatus: action.activeDirectoryStatus,
        activeDirectoryDetail: action.activeDirectoryDetail,
        overallStatus: action.overallStatus,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Offboarding failed to run." }, { status: 400 });
  }
}
