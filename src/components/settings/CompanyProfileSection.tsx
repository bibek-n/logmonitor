"use client";

import { useState, useRef, useEffect, FormEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageIcon, UploadCloud, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { CompanyProfileData } from "@/app/api/admin/settings/company-profile/route";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Values are stored/matched verbatim in the DB regardless of UI language — only the
// displayed option label is translated, via INDUSTRY_KEYS/SIZE_KEYS below.
const INDUSTRY_KEYS = [
  "informationTechnology",
  "financeBanking",
  "healthcare",
  "manufacturing",
  "retailEcommerce",
  "education",
  "government",
  "telecommunications",
  "other",
] as const;
const INDUSTRY_VALUES: Record<(typeof INDUSTRY_KEYS)[number], string> = {
  informationTechnology: "Information Technology",
  financeBanking: "Finance & Banking",
  healthcare: "Healthcare",
  manufacturing: "Manufacturing",
  retailEcommerce: "Retail & E-commerce",
  education: "Education",
  government: "Government",
  telecommunications: "Telecommunications",
  other: "Other",
};

const SIZE_OPTIONS_VALUES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

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

export function CompanyProfileSection({ initialData }: { initialData: CompanyProfileData | null }) {
  const toast = useToast();
  const router = useRouter();
  const t = useTranslations("settings.companyProfile");
  const industryOptions = INDUSTRY_KEYS.map((key) => ({ label: t(`industries.${key}`), value: INDUSTRY_VALUES[key] }));
  const sizeOptions = SIZE_OPTIONS_VALUES.map((v) => ({ label: t("employeesCount", { count: v }), value: v }));
  const [form, setForm] = useState({
    companyName: initialData?.CompanyName ?? "",
    websiteUrl: initialData?.WebsiteUrl ?? "",
    industry: initialData?.Industry ?? "",
    companySize: initialData?.CompanySize ?? "",
    addressLine1: initialData?.AddressLine1 ?? "",
    addressLine2: initialData?.AddressLine2 ?? "",
    city: initialData?.City ?? "",
    state: initialData?.State ?? "",
    postalCode: initialData?.PostalCode ?? "",
    country: initialData?.Country ?? "",
    contactEmail: initialData?.ContactEmail ?? "",
    contactPhone: initialData?.ContactPhone ?? "",
  });
  const [logoPath, setLogoPath] = useState(initialData?.LogoPath ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs let the just-picked file preview instantly, before the upload round-trip —
  // must be revoked on change/unmount or each new selection leaks the previous blob URL.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickLogoFile(file: File | null | undefined) {
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoError(t("logoInvalidTypeError"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t("logoTooLargeError"));
      return;
    }
    setLogoError(null);
    setLogoFile(file);
  }

  function handleLogoDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    pickLogoFile(e.dataTransfer.files?.[0]);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      next.contactEmail = t("invalidEmailError");
    }
    if (form.websiteUrl && !/^https?:\/\//i.test(form.websiteUrl)) {
      next.websiteUrl = t("invalidUrlError");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
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

      const res = await fetch("/api/admin/settings/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));

      toast.show({ type: "success", message: t("profileSavedToast") });
      // Without this, the parent Server Component's initialData prop is never re-fetched —
      // switching Settings tabs away and back re-mounts this component with the same stale
      // pre-save data, which looks exactly like the just-saved Industry/Company Size (or any
      // other field) silently reverting.
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericErrorToast") });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm({
      companyName: initialData?.CompanyName ?? "",
      websiteUrl: initialData?.WebsiteUrl ?? "",
      industry: initialData?.Industry ?? "",
      companySize: initialData?.CompanySize ?? "",
      addressLine1: initialData?.AddressLine1 ?? "",
      addressLine2: initialData?.AddressLine2 ?? "",
      city: initialData?.City ?? "",
      state: initialData?.State ?? "",
      postalCode: initialData?.PostalCode ?? "",
      country: initialData?.Country ?? "",
      contactEmail: initialData?.ContactEmail ?? "",
      contactPhone: initialData?.ContactPhone ?? "",
    });
    setLogoFile(null);
    setLogoPath(initialData?.LogoPath ?? null);
    setLogoError(null);
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>

        <div id="field-company-name">
          <label style={labelStyle}>{t("companyNameLabel")}</label>
          <input style={fieldStyle} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder={t("companyNamePlaceholder")} />
        </div>

        <div id="field-company-logo">
          <label style={labelStyle}>{t("companyLogoLabel")}</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleLogoDrop}
            className="flex items-center gap-4"
            style={{
              border: `2px dashed ${dragActive ? "var(--primary)" : "var(--border)"}`,
              borderRadius: 12,
              padding: "1rem 1.25rem",
              cursor: "pointer",
              background: dragActive ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--surface-2)",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {logoPreviewUrl || logoPath ? (
                <img src={logoPreviewUrl ?? logoPath ?? undefined} alt={t("companyLogoAlt")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <ImageIcon size={26} style={{ color: "var(--ink-muted)" }} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-2" style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ink)" }}>
                <UploadCloud size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {logoFile ? logoFile.name : dragActive ? t("logoUploadDropHint") : t("logoUploadPromptTitle")}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.2rem" }}>{t("logoUploadPromptHint")}</div>
              {logoError && <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.2rem" }}>{logoError}</div>}
            </div>
            {logoFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLogoFile(null);
                  setLogoError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                title={t("logoRemoveSelected")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                  padding: "0.3rem",
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_LOGO_TYPES.join(",")}
              onChange={(e) => pickLogoFile(e.target.files?.[0])}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-website-url">
            <label style={labelStyle}>{t("websiteUrlLabel")}</label>
            <input style={fieldStyle} value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://example.com" />
            {errors.websiteUrl && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.websiteUrl}</span>}
          </div>
          <div id="field-industry">
            <label style={labelStyle}>{t("industryLabel")}</label>
            <Select value={form.industry} onChange={(v) => set("industry", v)} options={industryOptions} placeholder={t("selectIndustryPlaceholder")} />
          </div>
          <div id="field-company-size">
            <label style={labelStyle}>{t("companySizeLabel")}</label>
            <Select value={form.companySize} onChange={(v) => set("companySize", v)} options={sizeOptions} placeholder={t("selectSizePlaceholder")} />
          </div>
        </div>

        <div id="field-company-address">
          <label style={labelStyle}>{t("companyAddressLabel")}</label>
          <div className="flex flex-col gap-2">
            <input style={fieldStyle} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder={t("addressLine1Placeholder")} />
            <input style={fieldStyle} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} placeholder={t("addressLine2Placeholder")} />
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <input style={fieldStyle} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("cityPlaceholder")} />
              <input style={fieldStyle} value={form.state} onChange={(e) => set("state", e.target.value)} placeholder={t("stateProvincePlaceholder")} />
              <input style={fieldStyle} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} placeholder={t("postalCodePlaceholder")} />
              <input style={fieldStyle} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder={t("countryPlaceholder")} />
            </div>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-contact-email">
            <label style={labelStyle}>{t("contactEmailLabel")}</label>
            <input style={fieldStyle} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="contact@example.com" />
            {errors.contactEmail && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.contactEmail}</span>}
          </div>
          <div id="field-contact-phone">
            <label style={labelStyle}>{t("contactPhoneLabel")}</label>
            <input style={fieldStyle} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+1 555 123 4567" />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t("savingButton") : t("saveChangesButton")}
        </Button>
        <Button type="button" variant="secondary" onClick={handleReset} disabled={saving}>
          {t("resetButton")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} disabled={saving}>
          {t("cancelButton")}
        </Button>
      </div>
    </form>
  );
}
