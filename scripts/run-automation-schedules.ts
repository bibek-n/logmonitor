import "dotenv/config";
import { advanceScheduleAfterRun, createJob, getScript, listDueSchedules } from "../src/lib/automation/repository";

// Recurring Scheduled Jobs - same "Windows Scheduled Task -> tiny .ps1 wrapper -> tsx runs a
// .ts script that decides what's due" convention as every other recurring job in this app
// (website/API monitoring scan, its own aggregation/reports scripts, website performance).
// Queuing a due schedule's job is identical to a manual "Run Now" (see jobs/route.ts) - both
// funnel through repository.createJob(), which snapshots the script body at this exact moment.
async function main() {
  const due = await listDueSchedules();
  console.log(`Automation Scheduled Jobs: ${due.length} schedule(s) due.`);

  for (const schedule of due) {
    try {
      const script = await getScript(schedule.scriptId);
      if (!script) {
        console.warn(`Schedule "${schedule.name}" (#${schedule.id}) references a deleted script - skipping this run, still advancing NextRunAt.`);
        await advanceScheduleAfterRun(schedule.id, schedule.intervalMinutes);
        continue;
      }
      if (schedule.targetDeviceIds.length === 0) {
        console.warn(`Schedule "${schedule.name}" (#${schedule.id}) has no target devices - skipping this run, still advancing NextRunAt.`);
        await advanceScheduleAfterRun(schedule.id, schedule.intervalMinutes);
        continue;
      }

      const jobId = await createJob({
        scriptId: script.id,
        scriptNameSnapshot: script.name,
        powerShellBodySnapshot: script.powerShellBody,
        bashBodySnapshot: script.bashBody,
        timeoutSeconds: script.timeoutSeconds,
        triggerType: "Scheduled",
        scheduleId: schedule.id,
        requestedByUserId: null,
        deviceIds: schedule.targetDeviceIds,
      });

      await advanceScheduleAfterRun(schedule.id, schedule.intervalMinutes);
      console.log(`Schedule "${schedule.name}" (#${schedule.id}): queued job #${jobId} for ${schedule.targetDeviceIds.length} device(s).`);
    } catch (err) {
      console.error(`Failed to process schedule ${schedule.id} (${schedule.name}):`, err instanceof Error ? err.message : err);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
