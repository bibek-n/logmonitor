import { NodeSSH } from "node-ssh";
import { decryptSqlPassword } from "./credentials";
import type { InstanceToCollect } from "./shared";

const SSH_TIMEOUT_MS = 10_000;

// MySQL has no SQL-level way to report mysqld's own OS process CPU% (unlike SQL Server's
// dm_os_ring_buffers-based system-health record, queryable in pure T-SQL) - this is the same
// SSH-based approach as backupStatusSsh.ts, reusing the SAME SSH credentials already stored
// for the backup check (SshHost/SshPort/SshUsername/SshPasswordEncrypted), since both are
// read-only OS-level checks against the same box. Confirmed live: reading /proc/<pid>/stat's
// utime+stime twice one second apart and dividing the tick delta by the elapsed wall time is
// the standard way to get an instantaneous (not since-process-start-cumulative, unlike `ps`'s
// own %CPU column) CPU percentage - `ps`/`top` in single-shot mode both report a decaying
// average since the process started, which is useless as a "live" gauge for a process that's
// been running for weeks.
export async function collectCpuPctViaSsh(instance: InstanceToCollect): Promise<number | null> {
  if (!instance.SshHost || !instance.SshUsername || !instance.SshPasswordEncrypted) return null;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: instance.SshHost,
      port: instance.SshPort ?? 22,
      username: instance.SshUsername,
      password: decryptSqlPassword(instance.SshPasswordEncrypted),
      readyTimeout: SSH_TIMEOUT_MS,
    });

    const command = `
PID=$(pgrep -x mysqld | head -1)
if [ -z "$PID" ]; then PID=$(pgrep -x mariadbd | head -1); fi
if [ -z "$PID" ]; then echo "NOPID"; exit 0; fi
STAT1=$(awk '{print $14, $15}' /proc/$PID/stat 2>/dev/null)
if [ -z "$STAT1" ]; then echo "NOSTAT"; exit 0; fi
sleep 1
STAT2=$(awk '{print $14, $15}' /proc/$PID/stat 2>/dev/null)
HZ=$(getconf CLK_TCK)
echo "OK $STAT1 $STAT2 $HZ"
`;
    const res = await ssh.execCommand(command);
    const parts = res.stdout.trim().split(/\s+/);
    if (parts[0] !== "OK" || parts.length !== 6) return null;

    const [, utime1, stime1, utime2, stime2, hz] = parts.map(Number);
    const elapsedTicks = utime2 + stime2 - (utime1 + stime1);
    if (!Number.isFinite(elapsedTicks) || !Number.isFinite(hz) || hz <= 0) return null;

    // ~1 second wall-clock elapsed between the two /proc reads (the `sleep 1` above) - close
    // enough for a rough live gauge given SSH round-trip overhead is a few ms either side.
    return Math.max(0, (elapsedTicks / hz / 1) * 100);
  } catch (err) {
    console.error(`[cpuStatusSsh] Failed to read mysqld CPU% for "${instance.HostName}" via SSH:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    ssh.dispose();
  }
}
