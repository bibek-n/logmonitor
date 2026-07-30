"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

interface Stats {
  TotalActiveAssets: number;
  TotalServers: number;
  TotalDesktopsLaptops: number;
  AssetsUnderMaintenance: number;
  RetiredAssets: number;
  PasswordChangesOverdue: number;
  PasswordChangesDueSoon: number;
  CriticalPatchesPending: number;
  FailedPatchInstallations: number;
  SoftwareRequiringUpdates: number;
  UnsupportedSoftware: number;
  LicencesExpiringSoon: number;
  MaintenanceTasksDue: number;
  OverdueMaintenanceTasks: number;
  AssetsNotCheckedRecently: number;
}

const CARDS: { key: keyof Stats; label: string; href: string; tone?: "danger" | "warning" }[] = [
  { key: "TotalActiveAssets", label: "Active Assets", href: "/dashboard/it-assets/assets?status=Active" },
  { key: "TotalServers", label: "Servers", href: "/dashboard/it-assets/assets?assetType=Server" },
  { key: "TotalDesktopsLaptops", label: "Desktops & Laptops", href: "/dashboard/it-assets/assets" },
  { key: "AssetsUnderMaintenance", label: "Under Maintenance", href: "/dashboard/it-assets/assets?status=UnderMaintenance" },
  { key: "RetiredAssets", label: "Retired Assets", href: "/dashboard/it-assets/assets?status=Retired" },
  { key: "PasswordChangesOverdue", label: "Passwords Overdue", href: "/dashboard/it-assets/password-changes?status=Overdue", tone: "danger" },
  { key: "PasswordChangesDueSoon", label: "Passwords Due Soon", href: "/dashboard/it-assets/password-changes?status=DueSoon", tone: "warning" },
  { key: "CriticalPatchesPending", label: "Critical Patches Pending", href: "/dashboard/it-assets/patches?severity=Critical", tone: "danger" },
  { key: "FailedPatchInstallations", label: "Failed Patch Installs", href: "/dashboard/it-assets/patches?installationStatus=Failed", tone: "danger" },
  { key: "SoftwareRequiringUpdates", label: "Software Needing Updates", href: "/dashboard/it-assets/software", tone: "warning" },
  { key: "UnsupportedSoftware", label: "Unsupported Software", href: "/dashboard/it-assets/software", tone: "danger" },
  { key: "LicencesExpiringSoon", label: "Licences Expiring Soon", href: "/dashboard/it-assets/software", tone: "warning" },
  { key: "MaintenanceTasksDue", label: "Maintenance Due", href: "/dashboard/it-assets/maintenance", tone: "warning" },
  { key: "OverdueMaintenanceTasks", label: "Maintenance Overdue", href: "/dashboard/it-assets/maintenance", tone: "danger" },
  { key: "AssetsNotCheckedRecently", label: "Not Inventoried Recently", href: "/dashboard/it-assets/assets", tone: "warning" },
];

const TONE_COLOR: Record<string, string> = { danger: "var(--danger)", warning: "var(--warning)" };

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/it-asset-logsheet/dashboard");
      const data = await res.json();
      if (res.ok && data.ok) setStats(data.data);
    })();
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
      {CARDS.map((c) => (
        <Link key={c.key} href={c.href} style={{ textDecoration: "none", color: "inherit" }}>
          <Card style={{ cursor: "pointer" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.4rem" }}>{c.label}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: c.tone ? TONE_COLOR[c.tone] : "var(--ink)" }}>
              {stats ? stats[c.key] : "—"}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
