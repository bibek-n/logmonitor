"use client";

interface DeviceOption {
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  deviceType: string;
  os: string;
}

// Shared by Remote Tasks (one-off "Run Now") and Scheduled Jobs (recurring target list) - the
// only two places Automation lets an admin pick which endpoint-agent-enrolled devices a script
// runs against.
export function DeviceMultiSelect({
  devices,
  selected,
  onChange,
}: {
  devices: DeviceOption[];
  selected: string[];
  onChange: (deviceIds: string[]) => void;
}) {
  const selectedSet = new Set(selected);

  function toggle(deviceId: string) {
    if (selectedSet.has(deviceId)) onChange(selected.filter((id) => id !== deviceId));
    else onChange([...selected, deviceId]);
  }

  if (devices.length === 0) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No enrolled Server/Workstation devices found.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <label style={{ fontSize: "0.8rem" }}>Target Devices ({selected.length} selected)</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={() => onChange(devices.map((d) => d.deviceId))} style={linkButtonStyle}>
            Select all
          </button>
          <button type="button" onClick={() => onChange([])} style={linkButtonStyle}>
            Clear
          </button>
        </div>
      </div>
      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0.5rem",
        }}
      >
        {devices.map((d) => (
          <label key={d.deviceId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" checked={selectedSet.has(d.deviceId)} onChange={() => toggle(d.deviceId)} />
            <span>{d.deviceName || d.hostname}</span>
            <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
              ({d.deviceType} - {d.os === "windows" ? "Windows" : d.os === "linux" ? "Linux" : d.os})
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const linkButtonStyle = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: "0.78rem",
  cursor: "pointer",
  padding: 0,
};
