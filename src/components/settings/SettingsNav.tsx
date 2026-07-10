"use client";

import {
  Building2,
  Network,
  Users,
  ShieldCheck,
  Mail,
  Plug,
  Bell,
  Palette,
  DatabaseBackup,
  Settings2,
  History,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SETTINGS_SECTIONS, SECTION_LABEL_KEYS } from "@/lib/settingsSearchIndex";

const ICONS: Record<string, LucideIcon> = {
  "company-profile": Building2,
  organization: Network,
  "users-access": Users,
  security: ShieldCheck,
  "smtp-email": Mail,
  integrations: Plug,
  notifications: Bell,
  branding: Palette,
  "backup-data": DatabaseBackup,
  system: Settings2,
  "audit-log": History,
};

export function SettingsNav({ active, onSelect }: { active: string; onSelect: (key: string) => void }) {
  const t = useTranslations("settings.sections");
  return (
    <nav className="flex flex-col gap-1" style={{ minWidth: 220 }}>
      {SETTINGS_SECTIONS.map((s) => {
        const Icon = ICONS[s.key] ?? Settings2;
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className="flex items-center gap-2"
            style={{
              padding: "0.55rem 0.75rem",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "0.85rem",
              background: isActive ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "transparent",
              color: isActive ? "var(--primary)" : "var(--ink-secondary)",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <Icon size={16} />
            {t(SECTION_LABEL_KEYS[s.key])}
          </button>
        );
      })}
    </nav>
  );
}
