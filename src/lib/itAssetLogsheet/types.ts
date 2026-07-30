export type AssetType =
  | "Server"
  | "Desktop"
  | "Laptop"
  | "VirtualMachine"
  | "Firewall"
  | "Router"
  | "Switch"
  | "StorageDevice"
  | "Printer"
  | "Other";

export type AssetStatus = "Active" | "Inactive" | "UnderMaintenance" | "Retired" | "Disposed" | "Lost" | "Spare";
export type AssetCriticality = "Critical" | "High" | "Medium" | "Low";

export interface Asset {
  id: number;
  assetTag: string;
  hostname: string | null;
  deviceName: string | null;
  assetType: AssetType;
  deviceCategory: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  domainOrWorkgroup: string | null;
  isVirtual: boolean;
  department: string | null;
  location: string | null;
  assignedUser: string | null;
  assetOwner: string | null;
  responsibleTechnician: string | null;
  purchaseDate: string | null;
  warrantyExpiryDate: string | null;
  installationDate: string | null;
  status: AssetStatus;
  criticality: AssetCriticality;
  environment: string | null;
  lastInventoryCheckDate: string | null;
  nextInventoryCheckDate: string | null;
  notes: string | null;
  linkedDeviceId: number | null;
  linkedStaffId: number | null;
  createdAt: Date;
  createdByUserId: number | null;
  createdByUsername: string | null;
  updatedAt: Date;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
}

export type AccountType =
  | "LocalAdministrator"
  | "DomainAdministrator"
  | "ServiceAccount"
  | "DatabaseAccount"
  | "ApplicationAccount"
  | "NetworkDeviceAccount"
  | "BackupAccount"
  | "EmailAccount"
  | "Other";

export type PasswordStatus = "Current" | "DueSoon" | "DueToday" | "Overdue" | "NotConfigured";
export type VerificationStatus = "Pending" | "Verified" | "Failed";

export interface PasswordChangeLog {
  id: number;
  assetId: number;
  accountOrServiceName: string;
  accountType: AccountType;
  usernameOrAccountId: string | null;
  credentialLocationRef: string | null;
  lastPasswordChangeDate: string | null;
  rotationIntervalDays: number | null;
  nextPasswordChangeDate: string | null;
  status: PasswordStatus;
  changedBy: string | null;
  approvedBy: string | null;
  verificationStatus: VerificationStatus | null;
  verificationDate: string | null;
  reasonForChange: string | null;
  changeRequestNumber: string | null;
  notes: string | null;
  createdAt: Date;
  createdByUserId: number | null;
  createdByUsername: string | null;
  updatedAt: Date;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
}

export type UpdateType =
  | "OperatingSystemUpdate"
  | "SecurityPatch"
  | "FirmwareUpdate"
  | "DriverUpdate"
  | "ApplicationUpdate"
  | "AntivirusDefinition"
  | "Hotfix"
  | "EmergencyPatch"
  | "Other";

export type PatchSeverity = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type InstallationStatus = "Planned" | "Scheduled" | "InProgress" | "Installed" | "Failed" | "RolledBack" | "Deferred" | "NotApplicable";
export type ValidationStatus = "Pending" | "Successful" | "Failed" | "NotRequired";

export interface PatchUpdateLog {
  id: number;
  assetId: number;
  updateType: UpdateType;
  vendor: string | null;
  product: string | null;
  patchName: string;
  kbOrPatchReference: string | null;
  version: string | null;
  severity: PatchSeverity;
  releaseDate: string | null;
  scheduledInstallationDate: string | null;
  actualInstallationDate: string | null;
  installationStatus: InstallationStatus;
  rebootRequired: boolean;
  rebootCompleted: boolean;
  validationStatus: ValidationStatus;
  validationDate: string | null;
  installedBy: string | null;
  approvedBy: string | null;
  changeRequestNumber: string | null;
  failureReason: string | null;
  rollbackPerformed: boolean;
  rollbackDetails: string | null;
  notes: string | null;
  createdAt: Date;
  createdByUserId: number | null;
  createdByUsername: string | null;
  updatedAt: Date;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
}

export type ApprovalStatus = "Approved" | "PendingApproval" | "Rejected" | "NotRequired";
export type SoftwareStatus = "Installed" | "UpdateRequired" | "Unsupported" | "Unlicensed" | "Approved" | "Unapproved" | "Removed";

export interface SoftwareInventoryItem {
  id: number;
  assetId: number;
  softwareName: string;
  publisher: string | null;
  installedVersion: string | null;
  latestApprovedVersion: string | null;
  installationDate: string | null;
  installedBy: string | null;
  installationSource: string | null;
  licenceType: string | null;
  licenceKeyRef: string | null;
  licenceExpiryDate: string | null;
  numberOfLicences: number | null;
  businessOwner: string | null;
  technicalOwner: string | null;
  approvalStatus: ApprovalStatus;
  softwareStatus: SoftwareStatus;
  lastUpdatedDate: string | null;
  uninstallationDate: string | null;
  uninstalledBy: string | null;
  reasonForRemoval: string | null;
  notes: string | null;
  createdAt: Date;
  createdByUserId: number | null;
  createdByUsername: string | null;
  updatedAt: Date;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
}

export type ActivityType =
  | "PreventiveMaintenance"
  | "CorrectiveMaintenance"
  | "HardwareReplacement"
  | "ConfigurationChange"
  | "DatabaseBackup"
  | "BackupVerification"
  | "RestoreTest"
  | "VulnerabilityScan"
  | "AntivirusScan"
  | "DiskCleanup"
  | "PerformanceTuning"
  | "AccountReview"
  | "SecurityHardening"
  | "NetworkConfiguration"
  | "OperatingSystemUpgrade"
  | "Troubleshooting"
  | "Other";

export type MaintenanceStatus = "Planned" | "Scheduled" | "InProgress" | "Completed" | "Failed" | "Cancelled" | "Deferred";
export type MaintenancePriority = "Critical" | "High" | "Medium" | "Low";

export interface MaintenanceLog {
  id: number;
  assetId: number;
  activityType: ActivityType;
  activityTitle: string;
  description: string | null;
  scheduledDate: string | null;
  startAt: Date | null;
  completedAt: Date | null;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  performedBy: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  downtimeMinutes: number | null;
  serviceImpact: string | null;
  changeRequestNumber: string | null;
  incidentNumber: string | null;
  result: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  notes: string | null;
  createdAt: Date;
  createdByUserId: number | null;
  createdByUsername: string | null;
  updatedAt: Date;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
}

export interface AssetAttachment {
  id: number;
  assetId: number;
  maintenanceLogId: number | null;
  patchUpdateLogId: number | null;
  softwareInventoryId: number | null;
  originalFileName: string;
  storedFileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUserId: number | null;
  uploadedByUsername: string | null;
  uploadedAt: Date;
}

export interface ItAssetSettings {
  passwordDueSoonDays: number;
  patchDueSoonDays: number;
  maintenanceDueSoonDays: number;
  warrantyExpiryWarningDays: number;
  licenceExpiryWarningDays: number;
  inventoryCheckIntervalDays: number;
  notificationRecipients: string[];
  notificationFrequency: "Immediate" | "Daily" | "Weekly";
  escalationRecipients: string[];
  escalationAfterDays: number | null;
  criticalAssetsAlertImmediately: boolean;
  emailAlertsEnabled: boolean;
}

export const ASSET_TYPES: AssetType[] = ["Server", "Desktop", "Laptop", "VirtualMachine", "Firewall", "Router", "Switch", "StorageDevice", "Printer", "Other"];
export const ASSET_STATUSES: AssetStatus[] = ["Active", "Inactive", "UnderMaintenance", "Retired", "Disposed", "Lost", "Spare"];
export const ASSET_CRITICALITIES: AssetCriticality[] = ["Critical", "High", "Medium", "Low"];
export const ACCOUNT_TYPES: AccountType[] = ["LocalAdministrator", "DomainAdministrator", "ServiceAccount", "DatabaseAccount", "ApplicationAccount", "NetworkDeviceAccount", "BackupAccount", "EmailAccount", "Other"];
export const UPDATE_TYPES: UpdateType[] = ["OperatingSystemUpdate", "SecurityPatch", "FirmwareUpdate", "DriverUpdate", "ApplicationUpdate", "AntivirusDefinition", "Hotfix", "EmergencyPatch", "Other"];
export const PATCH_SEVERITIES: PatchSeverity[] = ["Critical", "High", "Medium", "Low", "Informational"];
export const INSTALLATION_STATUSES: InstallationStatus[] = ["Planned", "Scheduled", "InProgress", "Installed", "Failed", "RolledBack", "Deferred", "NotApplicable"];
export const VALIDATION_STATUSES: ValidationStatus[] = ["Pending", "Successful", "Failed", "NotRequired"];
export const ACTIVITY_TYPES: ActivityType[] = ["PreventiveMaintenance", "CorrectiveMaintenance", "HardwareReplacement", "ConfigurationChange", "DatabaseBackup", "BackupVerification", "RestoreTest", "VulnerabilityScan", "AntivirusScan", "DiskCleanup", "PerformanceTuning", "AccountReview", "SecurityHardening", "NetworkConfiguration", "OperatingSystemUpgrade", "Troubleshooting", "Other"];
export const MAINTENANCE_STATUSES: MaintenanceStatus[] = ["Planned", "Scheduled", "InProgress", "Completed", "Failed", "Cancelled", "Deferred"];
export const SOFTWARE_STATUSES: SoftwareStatus[] = ["Installed", "UpdateRequired", "Unsupported", "Unlicensed", "Approved", "Unapproved", "Removed"];
export const APPROVAL_STATUSES: ApprovalStatus[] = ["Approved", "PendingApproval", "Rejected", "NotRequired"];
