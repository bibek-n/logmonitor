import crypto from "crypto";
import { runRemoteCommand } from "./connectionService";
import { completeScriptExecution, createScriptExecution, getScript } from "./repository";
import { writeAuditEvent } from "./auditLog";

const OUTPUT_CAP_CHARS = 256 * 1024; // bounded, same discipline as RemoteSessionLogs/Terminal output

export interface ScriptRunResult {
  connectionId: number;
  executionId: number;
  status: "Completed" | "Failed";
  exitCode: number | null;
  errorMessage: string | null;
}

// Runs one saved script against one or more connections. A run across more than one connection
// shares a single BatchId so its results correlate in the execution history - the confirmation
// requirement for that case is enforced by executeScriptSchema (schema.ts), not here. The audit
// log records the script NAME/id only, per writeAuditEvent()'s "action is a label, never a
// secret or full command output" contract - runRemoteCommand() never string-builds the command
// from request input (the script body is stored, trusted content, not per-call user input).
export async function runScript(scriptId: number, connectionIds: number[], userId: number, username: string): Promise<{ batchId: string | null; results: ScriptRunResult[] }> {
  const script = await getScript(scriptId);
  if (!script) throw new Error("Script not found");

  const batchId = connectionIds.length > 1 ? crypto.randomUUID() : null;
  const results: ScriptRunResult[] = [];

  for (const connectionId of connectionIds) {
    const executionId = await createScriptExecution(scriptId, connectionId, batchId, userId);
    try {
      const { stdout, stderr, code } = await runRemoteCommand(connectionId, script.body);
      const output = `${stdout}${stderr ? `\n--- stderr ---\n${stderr}` : ""}`.slice(0, OUTPUT_CAP_CHARS);
      await completeScriptExecution(executionId, { status: "Completed", exitCode: code, output, errorMessage: null });
      await writeAuditEvent({ eventType: "ScriptExecuted", userId, username, connectionId, action: `${script.name} (#${scriptId})`, result: "Success" });
      results.push({ connectionId, executionId, status: "Completed", exitCode: code, errorMessage: null });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await completeScriptExecution(executionId, { status: "Failed", exitCode: null, output: "", errorMessage });
      await writeAuditEvent({ eventType: "ScriptExecuted", userId, username, connectionId, action: `${script.name} (#${scriptId})`, result: "Failure", failureReason: errorMessage });
      results.push({ connectionId, executionId, status: "Failed", exitCode: null, errorMessage });
    }
  }

  return { batchId, results };
}
