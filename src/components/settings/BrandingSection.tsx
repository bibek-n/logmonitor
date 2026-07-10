"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import type { BrandingData } from "@/app/api/admin/settings/branding/route";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };

export function BrandingSection({ initialData }: { initialData: BrandingData | null }) {
  const toast = useToast();
  const t = useTranslations("settings.branding");
  const [form, setForm] = useState({
    primaryColor: initialData?.PrimaryColor ?? "#3B82F6",
    secondaryColor: initialData?.SecondaryColor ?? "#2563EB",
    loginBrandingEnabled: initialData?.LoginBrandingEnabled ?? false,
    loginTagline: initialData?.LoginTagline ?? "",
    footerText: initialData?.FooterText ?? "",
  });
  const [logoPath, setLogoPath] = useState(initialData?.LogoPath ?? null);
  const [faviconPath, setFaviconPath] = useState(initialData?.FaviconPath ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        const res = await fetch("/api/admin/settings/company-profile/logo", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? t("logoUploadFailedError"));
        setLogoPath(data.logoPath);
        setLogoFile(null);
      }
      if (faviconFile) {
        const fd = new FormData();
        fd.append("favicon", faviconFile);
        const res = await fetch("/api/admin/settings/branding/favicon", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? t("faviconUploadFailedError"));
        setFaviconPath(data.faviconPath);
        setFaviconFile(null);
      }

      const res = await fetch("/api/admin/settings/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));

      toast.show({ type: "success", message: t("brandingSavedToast") });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericErrorToast") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div id="field-primary-color">
          <label style={labelStyle}>{t("primaryColorLabel")}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.primaryColor} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} style={{ width: 40, height: 34, border: "none", background: "none", cursor: "pointer" }} />
            <input style={fieldStyle} value={form.primaryColor} onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))} />
          </div>
        </div>
        <div id="field-secondary-color">
          <label style={labelStyle}>{t("secondaryColorLabel")}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.secondaryColor} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))} style={{ width: 40, height: 34, border: "none", background: "none", cursor: "pointer" }} />
            <input style={fieldStyle} value={form.secondaryColor} onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div id="field-branding-logo">
          <label style={labelStyle}>{t("companyLogoLabel")}</label>
          <div className="flex items-center gap-3">
            {logoPath && <img src={logoPath} alt={t("logoAlt")} style={{ height: 40, width: 40, objectFit: "contain", borderRadius: 8, background: "var(--surface-2)" }} />}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} style={{ fontSize: "0.8rem" }} />
          </div>
        </div>
        <div id="field-favicon">
          <label style={labelStyle}>{t("faviconLabel")}</label>
          <div className="flex items-center gap-3">
            {faviconPath && <img src={faviconPath} alt={t("faviconAlt")} style={{ height: 24, width: 24, objectFit: "contain" }} />}
            <input type="file" accept="image/png,image/x-icon,image/svg+xml" onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)} style={{ fontSize: "0.8rem" }} />
          </div>
        </div>
      </div>

      <div id="field-login-branding" className="flex flex-col gap-2">
        <Switch checked={form.loginBrandingEnabled} onChange={(v) => setForm((f) => ({ ...f, loginBrandingEnabled: v }))} label={t("showLogoTaglineLabel")} />
        {form.loginBrandingEnabled && (
          <input
            style={fieldStyle}
            placeholder={t("loginTaglinePlaceholder")}
            value={form.loginTagline}
            onChange={(e) => setForm((f) => ({ ...f, loginTagline: e.target.value }))}
          />
        )}
      </div>

      <div id="field-custom-footer-text">
        <label style={labelStyle}>{t("customFooterTextLabel")}</label>
        <textarea
          style={{ ...fieldStyle, resize: "vertical" }}
          rows={2}
          value={form.footerText}
          onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
          placeholder={t("footerTextPlaceholder")}
        />
      </div>

      <div id="field-branding-email-templates" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
        {t("emailTemplatesNotice")}
      </div>

      <Button onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
        {saving ? t("savingButton") : t("saveChangesButton")}
      </Button>
    </Card>
  );
}
