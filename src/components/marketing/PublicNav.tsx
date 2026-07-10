"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Menu, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PUBLIC_NAV } from "@/lib/websiteContent";
import { MKT } from "@/lib/marketingTheme";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${MKT.border}`,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0.85rem 1.25rem" }}
      >
        <Link href="/" className="flex items-center gap-2" style={{ color: MKT.ink, textDecoration: "none", fontWeight: 700 }}>
          <Activity size={22} style={{ color: MKT.primary }} />
          <span>Log Monitor</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6" style={{ fontSize: "0.9rem" }}>
          {PUBLIC_NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{ color: MKT.inkMuted, textDecoration: "none" }}>
              {t(item.key)}
            </Link>
          ))}
          <LanguageSwitcher />
          <Link
            href="/login"
            style={{
              background: MKT.primary,
              color: "#fff",
              padding: "0.5rem 1.1rem",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {t("login")}
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{ background: "none", border: "none", color: MKT.ink, cursor: "pointer" }}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden flex flex-col" style={{ padding: "0.5rem 1.25rem 1rem", borderTop: `1px solid ${MKT.border}` }}>
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ color: MKT.inkMuted, textDecoration: "none", padding: "0.6rem 0" }}
            >
              {t(item.key)}
            </Link>
          ))}
          <div style={{ padding: "0.6rem 0" }}>
            <LanguageSwitcher />
          </div>
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            style={{
              background: MKT.primary,
              color: "#fff",
              padding: "0.6rem 1rem",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              textAlign: "center",
              marginTop: "0.5rem",
            }}
          >
            {t("login")}
          </Link>
        </nav>
      )}
    </header>
  );
}
