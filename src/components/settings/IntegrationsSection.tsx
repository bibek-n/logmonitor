"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { INTEGRATION_PROVIDERS } from "@/lib/integrationsConfig";

interface IntegrationRow {
  ProviderKey: string;
  Enabled: boolean;
  ConfigJson: string | null;
}

export function IntegrationsSection({ rows }: { rows: IntegrationRow[] }) {
  const t = useTranslations("settings.integrations");
  const router = useRouter();
  const toast = useToast();
  const rowByKey = new Map(rows.map((r) => [r.ProviderKey, r]));

  return (
    <div className="flex flex-col gap-4" id="field-integrations">
      <Card>
        <div className="flex items-center gap-2">
          <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>
          <Badge tone="warning">{t("configOnlyBadge")}</Badge>
        </div>
      </Card>

      {INTEGRATION_PROVIDERS.map((provider) => (
        <IntegrationCard
          key={provider.key}
          provider={provider}
          row={rowByKey.get(provider.key)}
          onSaved={() => {
            toast.show({ type: "success", message: t("settingsSavedToast", { provider: provider.label }) });
            router.refresh();
          }}
        />
      ))}
    </div>
  );
}

function IntegrationCard({
  provider,
  row,
  onSaved,
}: {
  provider: (typeof INTEGRATION_PROVIDERS)[number];
  row: IntegrationRow | undefined;
  onSaved: () => void;
}) {
  const t = useTranslations("settings.integrations");
  const toast = useToast();
  const initialConfig: Record<string, string> = row?.ConfigJson ? JSON.parse(row.ConfigJson) : {};
  const [enabled, setEnabled] = useState(row?.Enabled ?? false);
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/integrations/${provider.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, config }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));
      onSaved();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("somethingWentWrongError") });
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.45rem 0.6rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--ink)",
    fontSize: "0.82rem",
  };

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>{provider.label}</strong>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>{provider.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={enabled ? "success" : "neutral"}>{enabled ? t("enabledStatus") : t("disabledStatus")}</Badge>
          <Switch checked={enabled} onChange={setEnabled} />
        </div>
      </div>
      {enabled && (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {provider.fields.map((f) => (
            <div key={f.key}>
              <label style={{ fontSize: "0.72rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.2rem" }}>{f.label}</label>
              <input
                style={fieldStyle}
                type={f.type === "password" ? "password" : "text"}
                placeholder={f.placeholder}
                value={config[f.key] ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
      <Button size="sm" onClick={save} disabled={saving} style={{ alignSelf: "flex-start" }}>
        {saving ? t("savingButton") : t("saveButton")}
      </Button>
    </Card>
  );
}
