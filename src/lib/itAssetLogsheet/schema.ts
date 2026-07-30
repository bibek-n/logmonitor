import { z } from "zod";
import {
  ASSET_TYPES,
  ASSET_STATUSES,
  ASSET_CRITICALITIES,
  ACCOUNT_TYPES,
  UPDATE_TYPES,
  PATCH_SEVERITIES,
  INSTALLATION_STATUSES,
  VALIDATION_STATUSES,
  ACTIVITY_TYPES,
  MAINTENANCE_STATUSES,
  SOFTWARE_STATUSES,
  APPROVAL_STATUSES,
} from "./types";

const dateStr = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const optDateStr = dateStr.optional().nullable();

export const createAssetSchema = z.object({
  assetTag: z.string().trim().min(1).max(100),
  hostname: z.string().trim().max(255).optional().nullable(),
  deviceName: z.string().trim().max(255).optional().nullable(),
  assetType: z.enum(ASSET_TYPES as [string, ...string[]]),
  deviceCategory: z.string().trim().max(100).optional().nullable(),
  manufacturer: z.string().trim().max(200).optional().nullable(),
  model: z.string().trim().max(200).optional().nullable(),
  serialNumber: z.string().trim().max(200).optional().nullable(),
  operatingSystem: z.string().trim().max(200).optional().nullable(),
  osVersion: z.string().trim().max(100).optional().nullable(),
  ipAddress: z.string().trim().max(45).optional().nullable(),
  macAddress: z.string().trim().max(20).optional().nullable(),
  domainOrWorkgroup: z.string().trim().max(200).optional().nullable(),
  isVirtual: z.boolean().default(false),
  department: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  assignedUser: z.string().trim().max(200).optional().nullable(),
  assetOwner: z.string().trim().max(200).optional().nullable(),
  responsibleTechnician: z.string().trim().max(200).optional().nullable(),
  purchaseDate: optDateStr,
  warrantyExpiryDate: optDateStr,
  installationDate: optDateStr,
  status: z.enum(ASSET_STATUSES as [string, ...string[]]).default("Active"),
  criticality: z.enum(ASSET_CRITICALITIES as [string, ...string[]]).default("Medium"),
  environment: z.string().trim().max(50).optional().nullable(),
  lastInventoryCheckDate: optDateStr,
  nextInventoryCheckDate: optDateStr,
  notes: z.string().trim().max(4000).optional().nullable(),
  linkedDeviceId: z.number().int().positive().optional().nullable(),
  linkedStaffId: z.number().int().positive().optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const createPasswordChangeLogSchema = z.object({
  accountOrServiceName: z.string().trim().min(1).max(200),
  accountType: z.enum(ACCOUNT_TYPES as [string, ...string[]]),
  usernameOrAccountId: z.string().trim().max(200).optional().nullable(),
  credentialLocationRef: z.string().trim().max(500).optional().nullable(),
  lastPasswordChangeDate: optDateStr,
  rotationIntervalDays: z.number().int().min(1).max(3650).optional().nullable(),
  changedBy: z.string().trim().max(200).optional().nullable(),
  approvedBy: z.string().trim().max(200).optional().nullable(),
  verificationStatus: z.enum(["Pending", "Verified", "Failed"]).optional().nullable(),
  verificationDate: optDateStr,
  reasonForChange: z.string().trim().max(500).optional().nullable(),
  changeRequestNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const updatePasswordChangeLogSchema = createPasswordChangeLogSchema.partial();

export const createPatchUpdateLogSchema = z
  .object({
    updateType: z.enum(UPDATE_TYPES as [string, ...string[]]),
    vendor: z.string().trim().max(200).optional().nullable(),
    product: z.string().trim().max(200).optional().nullable(),
    patchName: z.string().trim().min(1).max(300),
    kbOrPatchReference: z.string().trim().max(100).optional().nullable(),
    version: z.string().trim().max(100).optional().nullable(),
    severity: z.enum(PATCH_SEVERITIES as [string, ...string[]]).default("Medium"),
    releaseDate: optDateStr,
    scheduledInstallationDate: optDateStr,
    actualInstallationDate: optDateStr,
    installationStatus: z.enum(INSTALLATION_STATUSES as [string, ...string[]]).default("Planned"),
    rebootRequired: z.boolean().default(false),
    rebootCompleted: z.boolean().default(false),
    validationStatus: z.enum(VALIDATION_STATUSES as [string, ...string[]]).default("Pending"),
    validationDate: optDateStr,
    installedBy: z.string().trim().max(200).optional().nullable(),
    approvedBy: z.string().trim().max(200).optional().nullable(),
    changeRequestNumber: z.string().trim().max(100).optional().nullable(),
    failureReason: z.string().trim().max(1000).optional().nullable(),
    rollbackPerformed: z.boolean().default(false),
    rollbackDetails: z.string().trim().max(1000).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((v) => v.installationStatus !== "Failed" || !!v.failureReason, {
    message: "Failed installations must include a failure reason.",
    path: ["failureReason"],
  })
  .refine((v) => !v.rollbackPerformed || !!v.rollbackDetails, {
    message: "A rollback must include rollback details.",
    path: ["rollbackDetails"],
  })
  .refine((v) => !v.actualInstallationDate || !v.scheduledInstallationDate || v.actualInstallationDate >= v.scheduledInstallationDate, {
    message: "Actual installation date cannot be earlier than the scheduled date.",
    path: ["actualInstallationDate"],
  });

// .partial() can't be chained after .refine(), so updates skip business-rule refinement at the
// schema layer - the repository layer re-validates the same three rules against the merged
// (existing + patch) record before writing, which is what actually enforces them for PATCH.
export const updatePatchUpdateLogSchema = z.object({
  updateType: z.enum(UPDATE_TYPES as [string, ...string[]]).optional(),
  vendor: z.string().trim().max(200).optional().nullable(),
  product: z.string().trim().max(200).optional().nullable(),
  patchName: z.string().trim().min(1).max(300).optional(),
  kbOrPatchReference: z.string().trim().max(100).optional().nullable(),
  version: z.string().trim().max(100).optional().nullable(),
  severity: z.enum(PATCH_SEVERITIES as [string, ...string[]]).optional(),
  releaseDate: optDateStr,
  scheduledInstallationDate: optDateStr,
  actualInstallationDate: optDateStr,
  installationStatus: z.enum(INSTALLATION_STATUSES as [string, ...string[]]).optional(),
  rebootRequired: z.boolean().optional(),
  rebootCompleted: z.boolean().optional(),
  validationStatus: z.enum(VALIDATION_STATUSES as [string, ...string[]]).optional(),
  validationDate: optDateStr,
  installedBy: z.string().trim().max(200).optional().nullable(),
  approvedBy: z.string().trim().max(200).optional().nullable(),
  changeRequestNumber: z.string().trim().max(100).optional().nullable(),
  failureReason: z.string().trim().max(1000).optional().nullable(),
  rollbackPerformed: z.boolean().optional(),
  rollbackDetails: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const createSoftwareInventorySchema = z.object({
  softwareName: z.string().trim().min(1).max(300),
  publisher: z.string().trim().max(200).optional().nullable(),
  installedVersion: z.string().trim().max(100).optional().nullable(),
  latestApprovedVersion: z.string().trim().max(100).optional().nullable(),
  installationDate: optDateStr,
  installedBy: z.string().trim().max(200).optional().nullable(),
  installationSource: z.string().trim().max(300).optional().nullable(),
  licenceType: z.string().trim().max(100).optional().nullable(),
  // Masked value or vault reference only - never validated as a real key format, since a real
  // key must never be submitted here at all.
  licenceKeyRef: z.string().trim().max(300).optional().nullable(),
  licenceExpiryDate: optDateStr,
  numberOfLicences: z.number().int().min(0).max(1000000).optional().nullable(),
  businessOwner: z.string().trim().max(200).optional().nullable(),
  technicalOwner: z.string().trim().max(200).optional().nullable(),
  approvalStatus: z.enum(APPROVAL_STATUSES as [string, ...string[]]).default("PendingApproval"),
  softwareStatus: z.enum(SOFTWARE_STATUSES as [string, ...string[]]).default("Installed"),
  lastUpdatedDate: optDateStr,
  uninstallationDate: optDateStr,
  uninstalledBy: z.string().trim().max(200).optional().nullable(),
  reasonForRemoval: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const updateSoftwareInventorySchema = createSoftwareInventorySchema.partial();

export const createMaintenanceLogSchema = z
  .object({
    activityType: z.enum(ACTIVITY_TYPES as [string, ...string[]]),
    activityTitle: z.string().trim().min(1).max(300),
    description: z.string().trim().max(4000).optional().nullable(),
    scheduledDate: optDateStr,
    startAt: z.string().datetime().optional().nullable(),
    completedAt: z.string().datetime().optional().nullable(),
    status: z.enum(MAINTENANCE_STATUSES as [string, ...string[]]).default("Planned"),
    priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
    performedBy: z.string().trim().max(200).optional().nullable(),
    requestedBy: z.string().trim().max(200).optional().nullable(),
    approvedBy: z.string().trim().max(200).optional().nullable(),
    downtimeMinutes: z.number().int().min(0).max(1000000).optional().nullable(),
    serviceImpact: z.string().trim().max(500).optional().nullable(),
    changeRequestNumber: z.string().trim().max(100).optional().nullable(),
    incidentNumber: z.string().trim().max(100).optional().nullable(),
    result: z.string().trim().max(1000).optional().nullable(),
    followUpRequired: z.boolean().default(false),
    followUpDate: optDateStr,
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((v) => !v.completedAt || !v.startAt || new Date(v.completedAt) >= new Date(v.startAt), {
    message: "Completion date cannot be earlier than the start date.",
    path: ["completedAt"],
  });

export const updateMaintenanceLogSchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES as [string, ...string[]]).optional(),
  activityTitle: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  scheduledDate: optDateStr,
  startAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  status: z.enum(MAINTENANCE_STATUSES as [string, ...string[]]).optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  performedBy: z.string().trim().max(200).optional().nullable(),
  requestedBy: z.string().trim().max(200).optional().nullable(),
  approvedBy: z.string().trim().max(200).optional().nullable(),
  downtimeMinutes: z.number().int().min(0).max(1000000).optional().nullable(),
  serviceImpact: z.string().trim().max(500).optional().nullable(),
  changeRequestNumber: z.string().trim().max(100).optional().nullable(),
  incidentNumber: z.string().trim().max(100).optional().nullable(),
  result: z.string().trim().max(1000).optional().nullable(),
  followUpRequired: z.boolean().optional(),
  followUpDate: optDateStr,
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const updateItAssetSettingsSchema = z.object({
  passwordDueSoonDays: z.number().int().min(1).max(365).optional(),
  patchDueSoonDays: z.number().int().min(1).max(365).optional(),
  maintenanceDueSoonDays: z.number().int().min(1).max(365).optional(),
  warrantyExpiryWarningDays: z.number().int().min(1).max(365).optional(),
  licenceExpiryWarningDays: z.number().int().min(1).max(365).optional(),
  inventoryCheckIntervalDays: z.number().int().min(1).max(3650).optional(),
  notificationRecipients: z.array(z.string().trim().email()).max(50).optional(),
  notificationFrequency: z.enum(["Immediate", "Daily", "Weekly"]).optional(),
  escalationRecipients: z.array(z.string().trim().email()).max(50).optional(),
  escalationAfterDays: z.number().int().min(1).max(365).optional().nullable(),
  criticalAssetsAlertImmediately: z.boolean().optional(),
  emailAlertsEnabled: z.boolean().optional(),
});

export const bulkUpdateAssetsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  patch: z
    .object({
      status: z.enum(ASSET_STATUSES as [string, ...string[]]).optional(),
      department: z.string().trim().max(200).optional().nullable(),
      location: z.string().trim().max(200).optional().nullable(),
      criticality: z.enum(ASSET_CRITICALITIES as [string, ...string[]]).optional(),
      assignedUser: z.string().trim().max(200).optional().nullable(),
      responsibleTechnician: z.string().trim().max(200).optional().nullable(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "At least one field must be provided to update." }),
});

export const lookupValueSchema = z.object({
  category: z.string().trim().min(1).max(50),
  value: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});
