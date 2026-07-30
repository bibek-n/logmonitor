import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest), query: vi.fn() };
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar", Bit: "Bit" },
}));

// Real AES-256-GCM isn't the point of this test file (see secretCrypto.test.ts) - stubbed as a
// passthrough so config assertions can compare plain JSON instead of ciphertext.
vi.mock("./secretCrypto", () => ({
  encryptIdsSecret: (v: string) => `enc(${v})`,
  decryptIdsSecret: (v: string) => v.replace(/^enc\(/, "").replace(/\)$/, ""),
}));

const { sendSlackAlert, sendTeamsAlert, sendWebhookAlert, sendInAppAlert, sendNotificationEmail } = vi.hoisted(() => ({
  sendSlackAlert: vi.fn(),
  sendTeamsAlert: vi.fn(),
  sendWebhookAlert: vi.fn(),
  sendInAppAlert: vi.fn(),
  sendNotificationEmail: vi.fn(),
}));
vi.mock("@/lib/websiteApiMonitoring/alertChannels", () => ({ sendSlackAlert, sendTeamsAlert, sendWebhookAlert, sendInAppAlert }));
vi.mock("@/lib/notifyEmail", () => ({ sendNotificationEmail }));

import { dispatchAlertNotifications, listChannels } from "./notificationChannels";

beforeEach(() => {
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
  dbMock.query.mockReset();
  sendSlackAlert.mockReset().mockResolvedValue({ success: true, error: null });
  sendTeamsAlert.mockReset().mockResolvedValue({ success: true, error: null });
  sendWebhookAlert.mockReset().mockResolvedValue({ success: true, error: null });
  sendInAppAlert.mockReset().mockResolvedValue({ success: true, error: null });
  sendNotificationEmail.mockReset().mockResolvedValue({ success: true });
});

function channelRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    Id: 1, ChannelType: "slack", Name: "Test Slack", EncryptedConfig: 'enc({"webhookUrl":"https://hooks.slack.com/x"})',
    Enabled: true, MinSeverity: "high", CreatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("listChannels", () => {
  it("maps DB rows to NotificationChannelRow without exposing the decrypted config", async () => {
    dbMock.query.mockResolvedValueOnce({ recordset: [channelRow()] });
    const rows = await listChannels();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, channelType: "slack", name: "Test Slack", enabled: true, minSeverity: "high", hasConfig: true });
    expect(rows[0]).not.toHaveProperty("config");
    expect(rows[0]).not.toHaveProperty("EncryptedConfig");
  });

  it("reports hasConfig: false for a channel with no stored config", async () => {
    dbMock.query.mockResolvedValueOnce({ recordset: [channelRow({ EncryptedConfig: null })] });
    const rows = await listChannels();
    expect(rows[0].hasConfig).toBe(false);
  });
});

describe("dispatchAlertNotifications", () => {
  it("sends to a channel whose MinSeverity is at or below the alert severity", async () => {
    dbMock.query.mockResolvedValueOnce({ recordset: [channelRow({ MinSeverity: "medium" })] }); // listChannels
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [channelRow({ MinSeverity: "medium" })] }) // re-fetch for decrypt
      .mockResolvedValueOnce({ recordset: [] }); // recordDelivery insert

    await dispatchAlertNotifications({ alertId: 1, severity: "high", subject: "Test", body: "Body" });

    expect(sendSlackAlert).toHaveBeenCalledWith("https://hooks.slack.com/x", "Test", "Body");
  });

  it("skips a channel whose MinSeverity is above the alert severity", async () => {
    dbMock.query.mockResolvedValueOnce({ recordset: [channelRow({ MinSeverity: "critical" })] });

    await dispatchAlertNotifications({ alertId: 1, severity: "medium", subject: "Test", body: "Body" });

    expect(sendSlackAlert).not.toHaveBeenCalled();
  });

  it("skips a disabled channel even if severity would otherwise qualify", async () => {
    dbMock.query.mockResolvedValueOnce({ recordset: [channelRow({ Enabled: false })] });

    await dispatchAlertNotifications({ alertId: 1, severity: "critical", subject: "Test", body: "Body" });

    expect(sendSlackAlert).not.toHaveBeenCalled();
  });

  it("does nothing when there are no configured channels", async () => {
    dbMock.query.mockResolvedValueOnce({ recordset: [] });
    await dispatchAlertNotifications({ alertId: 1, severity: "critical", subject: "Test", body: "Body" });
    expect(sendSlackAlert).not.toHaveBeenCalled();
    expect(dbRequest.query).not.toHaveBeenCalled();
  });
});
