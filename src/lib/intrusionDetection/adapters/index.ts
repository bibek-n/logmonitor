import { collectSophosThreat } from "./sophosThreatAdapter";
import { collectSophosWebFilter } from "./sophosWebFilterAdapter";
import { collectLoginActivity } from "./loginActivityAdapter";
import { collectIisAccessLog } from "./iisAccessLogAdapter";
import type { LogAdapterFn } from "./types";

// New adapters register here and nowhere else - the collector loop (collect.ts) is
// entirely adapter-agnostic, it just looks up AdapterType in this map. An adapter type
// with no entry (or a disabled SecurityLogSources row) is silently skipped, satisfying
// "unavailable tools can be disabled without breaking the application".
export const ADAPTERS: Record<string, LogAdapterFn> = {
  SophosThreat: collectSophosThreat,
  SophosWebFilter: collectSophosWebFilter,
  AdminAuditLog: collectLoginActivity,
  IisAccessLog: collectIisAccessLog,
};
