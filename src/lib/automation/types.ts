export type AutomationJobTargetStatus = "Pending" | "Running" | "Success" | "Failed" | "TimedOut" | "Error";
export type AutomationTriggerType = "Manual" | "Scheduled";

export interface AutomationScript {
  id: number;
  name: string;
  description: string | null;
  powerShellBody: string | null;
  bashBody: string | null;
  timeoutSeconds: number;
  createdByUserId: number | null;
  createdAt: Date;
  updatedByUserId: number | null;
  updatedAt: Date;
}

export interface AutomationDeviceSummary {
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  deviceType: string;
  os: string;
}

export interface AutomationJobTarget {
  id: number;
  jobId: number;
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  os: string;
  status: AutomationJobTargetStatus;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface AutomationJob {
  id: number;
  scriptId: number | null;
  scriptNameSnapshot: string;
  timeoutSeconds: number;
  triggerType: AutomationTriggerType;
  scheduleId: number | null;
  requestedByUserId: number | null;
  createdAt: Date;
  targets: AutomationJobTarget[];
}

export interface AutomationSchedule {
  id: number;
  scriptId: number;
  scriptName?: string;
  name: string;
  intervalMinutes: number;
  nextRunAt: Date;
  lastRunAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  targetDeviceIds: string[];
}

// One request the agent's heartbeat response carries - resolved to the body matching the
// target device's own OS (never both), so the agent never has to decide which one to run.
export interface PendingAutomationJobPayload {
  requestId: number;
  jobId: number;
  scriptBody: string;
  shell: "powershell" | "bash";
  timeoutSeconds: number;
}
