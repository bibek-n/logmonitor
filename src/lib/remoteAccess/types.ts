export type RemoteProtocol = "SSH" | "RDP" | "SFTP" | "SCP" | "FTP" | "FTPS" | "VNC" | "Telnet" | "WinRM" | "WebAdmin" | "SerialConsole";
export type RemoteEnvironment = "Production" | "Staging" | "Development" | "Testing" | "DisasterRecovery" | "Local" | "Custom";
export type AvailabilityStatus = "Online" | "Offline" | "Degraded" | "Unknown";
export type CredentialType = "UsernamePassword" | "WindowsDomain" | "SshKeyPassphrase" | "Rdp" | "Ftp" | "ApiToken" | "Certificate" | "Database" | "Custom";
export type SshKeyType = "Ed25519" | "Rsa";
export type SessionType = "Terminal" | "Sftp";
export type SessionStatus = "Active" | "Ended" | "Failed" | "Terminated";
export type InventoryDeviceTypeCategory = "WindowsServer" | "LinuxServer" | "Pc" | "NetworkDevice" | "VirtualMachine" | "Container" | "Cloud";

// The 18 event types from the spec's Connection Logs section, plus a couple of connection-
// checker-driven ones this plan added. writeAuditEvent() (auditLog.ts) is the only place that
// ever inserts a RemoteAuditLog row - never call sites directly - so the redaction guarantee
// (never a password/key/token/passphrase in any field) is enforced in exactly one place.
export type RemoteAuditEventType =
  | "ConnectionStarted"
  | "ConnectionCompleted"
  | "ConnectionFailed"
  | "SessionDisconnected"
  | "AuthenticationFailed"
  | "HostKeyChanged"
  | "CertificateRejected"
  | "CommandExecuted"
  | "ScriptExecuted"
  | "FileUploaded"
  | "FileDownloaded"
  | "FileDeleted"
  | "PortForwardingStarted"
  | "PortForwardingStopped"
  | "CredentialUsed"
  | "CredentialRevealed"
  | "DeviceRestarted"
  | "DeviceShutDown";

export interface RemoteConnectionGroup {
  id: number;
  name: string;
  parentGroupId: number | null;
}

export interface RemoteConnection {
  id: number;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  port: number;
  protocol: RemoteProtocol;
  username: string | null;
  domain: string | null;
  credentialId: number | null;
  sshKeyId: number | null;
  remoteDirectory: string | null;
  operatingSystem: string | null;
  deviceType: string | null;
  environment: RemoteEnvironment;
  customer: string | null;
  location: string | null;
  groupId: number | null;
  tags: string[];
  notes: string | null;
  isFavorite: boolean;
  connectionTimeoutSeconds: number;
  keepaliveIntervalSeconds: number;
  autoReconnect: boolean;
  jumpHostConnectionId: number | null;
  preConnectCommand: string | null;
  postConnectCommand: string | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  availabilityStatus: AvailabilityStatus;
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean;
  createdByUserId: number | null;
}

// Never carries the decrypted secret - see repository.ts's mapper, which strips EncryptedSecret
// before this object is ever constructed.
export interface RemoteCredential {
  id: number;
  name: string;
  credentialType: CredentialType;
  username: string | null;
  domain: string | null;
  expiresAt: Date | null;
  lastRotatedAt: Date | null;
  rotationReminderDays: number | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
}

// Never carries the decrypted private key - only the public key and fingerprint.
export interface RemoteSshKey {
  id: number;
  name: string;
  keyType: SshKeyType;
  publicKey: string;
  fingerprint: string;
  passphraseCredentialId: number | null;
  expiresAt: Date | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
}

export interface RemoteSession {
  id: number;
  connectionId: number | null;
  sessionType: SessionType;
  protocol: RemoteProtocol;
  targetHost: string;
  targetPort: number;
  isAdHoc: boolean;
  startedByUserId: number;
  startedByUsername: string | null;
  startedAt: Date;
  endedAt: Date | null;
  status: SessionStatus;
}

export interface RemoteInventoryDevice {
  id: number;
  linkedDeviceId: string | null;
  linkedConnectionId: number | null;
  deviceName: string;
  hostname: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  deviceTypeCategory: InventoryDeviceTypeCategory | null;
  cpu: string | null;
  memory: string | null;
  disk: string | null;
  environment: string | null;
  customer: string | null;
  owner: string | null;
  location: string | null;
  assetNumber: string | null;
  serialNumber: string | null;
  availableProtocols: string[];
  openManagementPorts: number[];
  monitoringStatus: string | null;
  availabilityStatus: AvailabilityStatus;
  lastConnectionAt: Date | null;
  tags: string[];
  notes: string | null;
}

export interface RemoteAuditLogRow {
  id: number;
  eventType: RemoteAuditEventType;
  userId: number | null;
  username: string | null;
  protocol: RemoteProtocol | null;
  connectionId: number | null;
  host: string | null;
  sourceIp: string | null;
  sessionId: number | null;
  action: string | null;
  result: "Success" | "Failure";
  failureReason: string | null;
  durationMs: number | null;
  createdAt: Date;
}
