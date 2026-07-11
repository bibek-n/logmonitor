"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface AvailableDevice {
  IpAddress: string;
  MacAddress: string;
  Hostname: string | null;
  Source: "Mikrotik" | "Sophos";
}

export default function DeviceSelect({ devices }: { devices: AvailableDevice[] }) {
  const t = useTranslations("employees.deviceSelect");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.IpAddress.toLowerCase().includes(q) ||
        d.MacAddress.toLowerCase().includes(q) ||
        d.Source.toLowerCase().includes(q) ||
        (d.Hostname ?? "").toLowerCase().includes(q)
    );
  }, [devices, query]);

  // If the search filters out the currently selected device, fall back to unassigned
  // rather than silently submitting a MAC that's no longer visible in the list.
  const stillVisible = !selected || filtered.some((d) => d.MacAddress === selected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // This input lives inside the Add Staff <form> — don't let Enter submit it.
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={t("searchPlaceholder")}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--plane)",
            color: "var(--ink)",
            fontSize: "0.9rem",
          }}
        />
        <button
          type="button"
          onClick={() => setQuery("")}
          title={t("clearSearchTitle")}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--plane)",
            color: "var(--ink-muted)",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          &#10005; {t("clearButton")}
        </button>
      </div>
      <select
        id="mac"
        name="mac"
        value={stillVisible ? selected : ""}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          width: "100%",
          padding: "0.6rem 0.75rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--plane)",
          color: "var(--ink)",
          fontSize: "0.95rem",
        }}
      >
        <option value="">{t("unassignedOption")}</option>
        {filtered.map((d) => (
          <option key={`${d.Source}-${d.MacAddress}`} value={d.MacAddress}>
            [{d.Source}] {d.IpAddress} &middot; {d.Hostname ?? t("unknownHostnameFallback")} ({d.MacAddress})
          </option>
        ))}
      </select>
      <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>
        {t("devicesShownCount", { shown: filtered.length, total: devices.length })}
      </span>
    </div>
  );
}
