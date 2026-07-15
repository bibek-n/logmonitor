"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import type { SecuritySettingsData } from "@/app/api/admin/settings/security/route";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.83rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };

export function SecuritySection({ initialData }: { initialData: SecuritySettingsData | null }) {
  const toast = useToast();
  const router = useRouter();
  const t = useTranslations("settings.security");
  const [form, setForm] = useState({
    passwordMinLength: initialData?.PasswordMinLength ?? 8,
    passwordRequireUppercase: initialData?.PasswordRequireUppercase ?? true,
    passwordRequireNumber: initialData?.PasswordRequireNumber ?? true,
    passwordRequireSymbol: initialData?.PasswordRequireSymbol ?? false,
    ssoEnabled: initialData?.SsoEnabled ?? false,
    ssoProvider: initialData?.SsoProvider ?? "",
    ipWhitelist: initialData?.IpWhitelist ?? "",
    sessionTimeoutMinutes: initialData?.SessionTimeoutMinutes ?? 60,
    lockoutThreshold: initialData?.LockoutThreshold ?? 5,
    lockoutDurationMinutes: initialData?.LockoutDurationMinutes ?? 15,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));
      toast.show({ type: "success", message: t("settingsSavedToast") });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericErrorToast") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>
        <Badge tone="warning">{t("configOnlyBadge")}</Badge>
      </div>

      <div id="field-password-policy">
        <h3 style={{ fontSize: "0.9rem", color: "var(--ink)", margin: "0 0 0.5rem" }}>{t("passwordPolicyTitle")}</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={labelStyle}>{t("minimumLengthLabel")}</label>
            <input style={fieldStyle} type="number" min={6} value={form.passwordMinLength} onChange={(e) => setForm((f) => ({ ...f, passwordMinLength: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="flex flex-col gap-2" style={{ marginTop: "0.5rem" }}>
          <Switch checked={form.passwordRequireUppercase} onChange={(v) => setForm((f) => ({ ...f, passwordRequireUppercase: v }))} label={t("requireUppercaseLabel")} />
          <Switch checked={form.passwordRequireNumber} onChange={(v) => setForm((f) => ({ ...f, passwordRequireNumber: v }))} label={t("requireNumberLabel")} />
          <Switch checked={form.passwordRequireSymbol} onChange={(v) => setForm((f) => ({ ...f, passwordRequireSymbol: v }))} label={t("requireSymbolLabel")} />
        </div>
      </div>

      <div id="field-single-sign-on" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <div className="flex items-center gap-2">
          <h3 style={{ fontSize: "0.9rem", color: "var(--ink)", margin: 0 }}>{t("singleSignOnTitle")}</h3>
          <Tooltip content={t("ssoTooltip")}>
            <Badge tone="info">{t("comingSoonBadge")}</Badge>
          </Tooltip>
        </div>
        <div className="flex flex-col gap-2" style={{ marginTop: "0.5rem" }}>
          <Switch checked={form.ssoEnabled} onChange={(v) => setForm((f) => ({ ...f, ssoEnabled: v }))} label={t("enableSsoLabel")} />
          {form.ssoEnabled && (
            <input style={fieldStyle} placeholder={t("ssoProviderPlaceholder")} value={form.ssoProvider} onChange={(e) => setForm((f) => ({ ...f, ssoProvider: e.target.value }))} />
          )}
        </div>
      </div>

      <div id="field-ip-whitelisting" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <label style={labelStyle}>{t("ipWhitelistingLabel")}</label>
        <textarea
          style={{ ...fieldStyle, resize: "vertical" }}
          rows={3}
          value={form.ipWhitelist}
          onChange={(e) => setForm((f) => ({ ...f, ipWhitelist: e.target.value }))}
          placeholder={"203.0.113.10\n198.51.100.0/24"}
        />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <div id="field-session-management">
          <label style={labelStyle}>{t("sessionTimeoutLabel")}</label>
          <input style={fieldStyle} type="number" value={form.sessionTimeoutMinutes ?? ""} onChange={(e) => setForm((f) => ({ ...f, sessionTimeoutMinutes: Number(e.target.value) }))} />
        </div>
        <div id="field-account-lockout-rules">
          <label style={labelStyle}>{t("lockoutAfterLabel")}</label>
          <input style={fieldStyle} type="number" value={form.lockoutThreshold ?? ""} onChange={(e) => setForm((f) => ({ ...f, lockoutThreshold: Number(e.target.value) }))} />
        </div>
        <div>
          <label style={labelStyle}>{t("lockoutDurationLabel")}</label>
          <input style={fieldStyle} type="number" value={form.lockoutDurationMinutes ?? ""} onChange={(e) => setForm((f) => ({ ...f, lockoutDurationMinutes: Number(e.target.value) }))} />
        </div>
      </div>

      <div id="field-api-keys" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
        {t("apiKeysNotice")}
      </div>

      <Button onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
        {saving ? t("savingButton") : t("saveChangesButton")}
      </Button>
    </Card>
  );
}
