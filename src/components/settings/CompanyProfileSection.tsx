"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { CompanyProfileData } from "@/app/api/admin/settings/company-profile/route";

const INDUSTRY_OPTIONS = [
  "Information Technology",
  "Finance & Banking",
  "Healthcare",
  "Manufacturing",
  "Retail & E-commerce",
  "Education",
  "Government",
  "Telecommunications",
  "Other",
].map((v) => ({ label: v, value: v }));

const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"].map((v) => ({ label: v + " employees", value: v }));

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
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      next.contactEmail = "Enter a valid email address.";
    }
    if (form.websiteUrl && !/^https?:\/\//i.test(form.websiteUrl)) {
      next.websiteUrl = "URL must start with http:// or https://";
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
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Logo upload failed");
        setLogoPath(data.logoPath);
        setLogoFile(null);
      }

      const res = await fetch("/api/admin/settings/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");

      toast.show({ type: "success", message: "Company profile saved." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
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
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Company Profile</h2>

        <div id="field-company-name">
          <label style={labelStyle}>Company Name</label>
          <input style={fieldStyle} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Acme IT Solutions" />
        </div>

        <div id="field-company-logo">
          <label style={labelStyle}>Company Logo</label>
          <div className="flex items-center gap-3">
            {logoPath && <img src={logoPath} alt="Company logo" style={{ height: 44, width: 44, objectFit: "contain", borderRadius: 8, background: "var(--surface-2)" }} />}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} style={{ fontSize: "0.82rem" }} />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-website-url">
            <label style={labelStyle}>Website URL</label>
            <input style={fieldStyle} value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://example.com" />
            {errors.websiteUrl && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.websiteUrl}</span>}
          </div>
          <div id="field-industry">
            <label style={labelStyle}>Industry</label>
            <Select value={form.industry} onChange={(v) => set("industry", v)} options={INDUSTRY_OPTIONS} placeholder="Select industry" />
          </div>
          <div id="field-company-size">
            <label style={labelStyle}>Company Size</label>
            <Select value={form.companySize} onChange={(v) => set("companySize", v)} options={SIZE_OPTIONS} placeholder="Select size" />
          </div>
        </div>

        <div id="field-company-address">
          <label style={labelStyle}>Company Address</label>
          <div className="flex flex-col gap-2">
            <input style={fieldStyle} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder="Address line 1" />
            <input style={fieldStyle} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} placeholder="Address line 2 (optional)" />
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <input style={fieldStyle} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
              <input style={fieldStyle} value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State / Province" />
              <input style={fieldStyle} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} placeholder="Postal Code" />
              <input style={fieldStyle} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Country" />
            </div>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-contact-email">
            <label style={labelStyle}>Contact Email</label>
            <input style={fieldStyle} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="contact@example.com" />
            {errors.contactEmail && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.contactEmail}</span>}
          </div>
          <div id="field-contact-phone">
            <label style={labelStyle}>Contact Phone Number</label>
            <input style={fieldStyle} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+1 555 123 4567" />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleReset} disabled={saving}>
          Reset
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
