import { z } from "zod";

const PROTOCOLS = ["SSH", "RDP", "SFTP", "SCP", "FTP", "FTPS", "VNC", "Telnet", "WinRM", "WebAdmin", "SerialConsole"] as const;
const ENVIRONMENTS = ["Production", "Staging", "Development", "Testing", "DisasterRecovery", "Local", "Custom"] as const;

export const createConnectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  hostname: z.string().trim().max(255).optional().nullable(),
  ipAddress: z.string().trim().max(45).optional().nullable(),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(PROTOCOLS),
  username: z.string().trim().max(200).optional().nullable(),
  domain: z.string().trim().max(200).optional().nullable(),
  credentialId: z.number().int().positive().optional().nullable(),
  sshKeyId: z.number().int().positive().optional().nullable(),
  remoteDirectory: z.string().trim().max(1000).optional().nullable(),
  operatingSystem: z.string().trim().max(30).optional().nullable(),
  deviceType: z.string().trim().max(30).optional().nullable(),
  environment: z.enum(ENVIRONMENTS).default("Production"),
  customer: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  groupId: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
  isFavorite: z.boolean().default(false),
  connectionTimeoutSeconds: z.number().int().min(1).max(300).default(15),
  keepaliveIntervalSeconds: z.number().int().min(1).max(600).default(30),
  autoReconnect: z.boolean().default(false),
  jumpHostConnectionId: z.number().int().positive().optional().nullable(),
  preConnectCommand: z.string().trim().max(1000).optional().nullable(),
  postConnectCommand: z.string().trim().max(1000).optional().nullable(),
  isShared: z.boolean().default(true),
}).refine((v) => !!v.hostname || !!v.ipAddress, {
  message: "Provide a hostname or an IP address.",
  path: ["hostname"],
});

export const updateConnectionSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  hostname: z.string().trim().max(255).optional().nullable(),
  ipAddress: z.string().trim().max(45).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional(),
  protocol: z.enum(PROTOCOLS).optional(),
  username: z.string().trim().max(200).optional().nullable(),
  domain: z.string().trim().max(200).optional().nullable(),
  credentialId: z.number().int().positive().optional().nullable(),
  sshKeyId: z.number().int().positive().optional().nullable(),
  remoteDirectory: z.string().trim().max(1000).optional().nullable(),
  operatingSystem: z.string().trim().max(30).optional().nullable(),
  deviceType: z.string().trim().max(30).optional().nullable(),
  environment: z.enum(ENVIRONMENTS).optional(),
  customer: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  groupId: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isFavorite: z.boolean().optional(),
  connectionTimeoutSeconds: z.number().int().min(1).max(300).optional(),
  keepaliveIntervalSeconds: z.number().int().min(1).max(600).optional(),
  autoReconnect: z.boolean().optional(),
  jumpHostConnectionId: z.number().int().positive().optional().nullable(),
  preConnectCommand: z.string().trim().max(1000).optional().nullable(),
  postConnectCommand: z.string().trim().max(1000).optional().nullable(),
  isShared: z.boolean().optional(),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentGroupId: z.number().int().positive().optional().nullable(),
});
export const updateGroupSchema = createGroupSchema.partial();

const CREDENTIAL_TYPES = ["UsernamePassword", "WindowsDomain", "SshKeyPassphrase", "Rdp", "Ftp", "ApiToken", "Certificate", "Database", "Custom"] as const;

export const createCredentialSchema = z.object({
  name: z.string().trim().min(1).max(200),
  credentialType: z.enum(CREDENTIAL_TYPES),
  secret: z.string().min(1).max(20_000),
  username: z.string().trim().max(200).optional().nullable(),
  domain: z.string().trim().max(200).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  rotationReminderDays: z.number().int().min(1).max(3650).optional().nullable(),
});
export const updateCredentialSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  secret: z.string().min(1).max(20_000).optional(),
  username: z.string().trim().max(200).optional().nullable(),
  domain: z.string().trim().max(200).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  rotationReminderDays: z.number().int().min(1).max(3650).optional().nullable(),
  isActive: z.boolean().optional(),
});

// Re-authentication accompanies the reveal request itself (never a standing "unlocked" cookie) -
// the currently logged-in user's own password, re-checked against Users.PasswordHash.
export const revealSecretSchema = z.object({
  password: z.string().min(1).max(500),
});

export const generateSshKeySchema = z.object({
  name: z.string().trim().min(1).max(200),
  keyType: z.enum(["Ed25519", "Rsa"]).default("Ed25519"),
  passphrase: z.string().min(1).max(500).optional().nullable(),
});
export const importSshKeySchema = z.object({
  name: z.string().trim().min(1).max(200),
  privateKey: z.string().min(1).max(20_000),
  passphrase: z.string().min(1).max(500).optional().nullable(),
});

export const quickConnectSchema = z.object({
  protocol: z.enum(PROTOCOLS),
  hostname: z.string().trim().max(255).optional().nullable(),
  ipAddress: z.string().trim().max(45).optional().nullable(),
  port: z.number().int().min(1).max(65535),
  username: z.string().trim().max(200).optional().nullable(),
  password: z.string().max(500).optional().nullable(),
  domain: z.string().trim().max(200).optional().nullable(),
  sshKeyId: z.number().int().positive().optional().nullable(),
  jumpHostConnectionId: z.number().int().positive().optional().nullable(),
  connectionTimeoutSeconds: z.number().int().min(1).max(300).default(15),
  saveConnection: z.boolean().default(false),
}).refine((v) => !!v.hostname || !!v.ipAddress, {
  message: "Provide a hostname or an IP address.",
  path: ["hostname"],
});

export const createInventoryDeviceSchema = z.object({
  linkedDeviceId: z.string().trim().max(36).optional().nullable(),
  linkedConnectionId: z.number().int().positive().optional().nullable(),
  deviceName: z.string().trim().min(1).max(200),
  hostname: z.string().trim().max(255).optional().nullable(),
  ipAddress: z.string().trim().max(45).optional().nullable(),
  macAddress: z.string().trim().max(20).optional().nullable(),
  operatingSystem: z.string().trim().max(30).optional().nullable(),
  osVersion: z.string().trim().max(100).optional().nullable(),
  deviceTypeCategory: z.enum(["WindowsServer", "LinuxServer", "Pc", "NetworkDevice", "VirtualMachine", "Container", "Cloud"]).optional().nullable(),
  cpu: z.string().trim().max(200).optional().nullable(),
  memory: z.string().trim().max(100).optional().nullable(),
  disk: z.string().trim().max(100).optional().nullable(),
  environment: z.string().trim().max(30).optional().nullable(),
  customer: z.string().trim().max(200).optional().nullable(),
  owner: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  assetNumber: z.string().trim().max(100).optional().nullable(),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export const updateInventoryDeviceSchema = createInventoryDeviceSchema.partial();

export const updateSettingsSchema = z.object({
  vaultLockAfterMinutes: z.number().int().min(1).max(1440).optional(),
  defaultConnectionTimeoutSeconds: z.number().int().min(1).max(300).optional(),
  defaultKeepaliveIntervalSeconds: z.number().int().min(1).max(600).optional(),
  connectionCheckIntervalMinutes: z.number().int().min(1).max(1440).optional(),
  notifyOnConnectionOfflineContactIds: z.string().trim().max(500).optional().nullable(),
  requireApprovalForBulkExecution: z.boolean().optional(),
  bulkExecutionApprovalThreshold: z.number().int().min(2).max(1000).optional(),
});

const SCRIPT_TYPES = ["Shell", "PowerShell", "Python", "Batch", "Command"] as const;

export const createScriptSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  scriptType: z.enum(SCRIPT_TYPES),
  body: z.string().min(1).max(50_000),
  targetOsFamily: z.enum(["Linux", "Windows", "Any"]).optional().nullable(),
});
export const updateScriptSchema = createScriptSchema.partial();

// Bulk execution (more than one connectionId) requires an explicit confirm:true, per the spec's
// "require confirmation for destructive/bulk actions" - checked server-side, not just trusted
// from a client-side dialog.
export const executeScriptSchema = z
  .object({
    connectionIds: z.array(z.number().int().positive()).min(1).max(100),
    confirm: z.boolean().default(false),
  })
  .refine((v) => v.connectionIds.length === 1 || v.confirm === true, {
    message: "Bulk execution across multiple connections requires confirmation.",
    path: ["confirm"],
  });

// Dynamic (SOCKS) is accepted here for completeness with the RemotePortForwards.ForwardType
// CHECK constraint, but startPortForward() (portForwardService.ts) rejects it at start time -
// a real SOCKS5 proxy server is a separate, larger undertaking not built in Phase 2.
export const createPortForwardSchema = z
  .object({
    connectionId: z.number().int().positive(),
    forwardType: z.enum(["Local", "Remote", "Dynamic"]),
    localPort: z.number().int().min(1).max(65535),
    remoteHost: z.string().trim().min(1).max(255).optional().nullable(),
    remotePort: z.number().int().min(1).max(65535).optional().nullable(),
  })
  .refine((v) => v.forwardType === "Dynamic" || (!!v.remoteHost && !!v.remotePort), {
    message: "Local and Remote forwards require a remote host and port.",
    path: ["remoteHost"],
  });
