import type { LogSourceRow } from "../store";
import type { NormalizedSecurityEvent } from "../shared";

export interface AdapterResult {
  events: NormalizedSecurityEvent[];
  // For DB-cursor adapters (Sophos/LoginActivity): the highest source-table Id processed.
  // For file adapters (IIS): the new byte offset into the current log file.
  newPosition: number;
  // File adapters only - lets the caller detect rotation/truncation on the next run.
  newFileSize?: number;
  newPositionFile?: string;
}

export type LogAdapterFn = (logSource: LogSourceRow) => Promise<AdapterResult>;
