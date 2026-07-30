import { describe, expect, it } from "vitest";
import { shouldCreateAlert } from "./alerts";

describe("shouldCreateAlert", () => {
  it("allows creation when no matching unread notification exists", () => {
    expect(
      shouldCreateAlert({ alertType: "PasswordOverdue", sourceTable: "PasswordChangeLogs", sourceRecordId: 1 }, [])
    ).toBe(true);
  });

  it("blocks creation when an identical unread notification already exists", () => {
    const existing = [{ alertType: "PasswordOverdue", sourceTable: "PasswordChangeLogs", sourceRecordId: 1 }];
    expect(shouldCreateAlert({ alertType: "PasswordOverdue", sourceTable: "PasswordChangeLogs", sourceRecordId: 1 }, existing)).toBe(false);
  });

  it("treats different source record ids as distinct", () => {
    const existing = [{ alertType: "PasswordOverdue", sourceTable: "PasswordChangeLogs", sourceRecordId: 1 }];
    expect(shouldCreateAlert({ alertType: "PasswordOverdue", sourceTable: "PasswordChangeLogs", sourceRecordId: 2 }, existing)).toBe(true);
  });

  it("treats different alert types on the same record as distinct", () => {
    const existing = [{ alertType: "PasswordOverdue", sourceTable: "PasswordChangeLogs", sourceRecordId: 1 }];
    expect(shouldCreateAlert({ alertType: "PasswordDueSoon", sourceTable: "PasswordChangeLogs", sourceRecordId: 1 }, existing)).toBe(true);
  });

  it("treats different source tables with the same id as distinct", () => {
    const existing = [{ alertType: "MaintenanceOverdue", sourceTable: "MaintenanceLogs", sourceRecordId: 5 }];
    expect(shouldCreateAlert({ alertType: "MaintenanceOverdue", sourceTable: "Assets", sourceRecordId: 5 }, existing)).toBe(true);
  });
});
