"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera as CameraIcon, RefreshCw, Trash2, Radar, Play, Pencil, MapPin, X, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LiveViewModal } from "./LiveViewModal";
import { PlaybackModal } from "./PlaybackModal";

export interface NvrDeviceSummary {
  Id: number;
  Name: string;
  IpAddress: string;
  Port: number;
  Status: string;
  LastSyncedAt: string | null;
  LastError: string | null;
  CameraCount: number;
}

export interface CameraSummary {
  Id: number;
  NvrId: number;
  NvrName: string;
  ChannelName: string;
  Status: string;
  LastSeenAt: string | null;
  Label: string | null;
  Location: string | null;
  SortOrder: number;
}

interface DiscoveredDevice {
  address: string;
  xaddrs: string[];
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";

function statusTone(status: string): Tone {
  switch (status) {
    case "Online":
      return "success";
    case "Error":
      return "danger";
    default:
      return "neutral";
  }
}

export function CamerasClient({ initialDevices, initialCameras }: { initialDevices: NvrDeviceSummary[]; initialCameras: CameraSummary[] }) {
  const router = useRouter();
  const [devices] = useState(initialDevices);
  const [cameras, setCameras] = useState(initialCameras);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [thumbnailTick, setThumbnailTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setThumbnailTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [showAddForm, setShowAddForm] = useState(initialDevices.length === 0);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", ipAddress: "", port: 80, username: "", password: "", onvifPath: "/onvif/device_service" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [liveCamera, setLiveCamera] = useState<CameraSummary | null>(null);
  const [playbackCamera, setPlaybackCamera] = useState<CameraSummary | null>(null);
  const [editingCamera, setEditingCamera] = useState<CameraSummary | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  function openLabelEditor(cam: CameraSummary) {
    setEditingCamera(cam);
    setEditLabel(cam.Label ?? "");
    setEditLocation(cam.Location ?? "");
  }

  async function handleSaveLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCamera) return;
    setSavingLabel(true);
    try {
      await fetch(`/api/admin/nvr/cameras/${editingCamera.Id}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel, location: editLocation }),
      });
      setEditingCamera(null);
      router.refresh();
    } finally {
      setSavingLabel(false);
    }
  }

  function handleDrop(targetId: number) {
    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const fromIndex = cameras.findIndex((c) => c.Id === draggedId);
    const toIndex = cameras.findIndex((c) => c.Id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }
    const reordered = [...cameras];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setCameras(reordered);
    setDraggedId(null);
    fetch("/api/admin/nvr/cameras/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((c) => c.Id) }),
    }).catch(() => {});
  }

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    setDiscovered(null);
    try {
      const res = await fetch("/api/admin/nvr/scan", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Scan failed");
      setDiscovered(data.devices);
      if (data.devices.length === 0) {
        setScanError(
          "No ONVIF devices responded. This only finds devices on the same network segment as this server  -  if your NVR is on a different VLAN, enter its IP manually below."
        );
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleAddNvr(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/nvr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to add NVR");
      if (data.sync && !data.sync.ok) {
        setSaveError(`NVR saved, but couldn't fetch cameras yet: ${data.sync.error}. You can retry from the "Re-sync" button below.`);
      }
      router.refresh();
      setShowAddForm(false);
      setForm({ name: "", ipAddress: "", port: 80, username: "", password: "", onvifPath: "/onvif/device_service" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to add NVR");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(nvrId: number) {
    setSyncingId(nvrId);
    try {
      const res = await fetch(`/api/admin/nvr/${nvrId}/sync`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Sync failed");
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(nvrId: number) {
    if (!confirm("Remove this NVR and all its cameras from the dashboard?")) return;
    await fetch(`/api/admin/nvr/${nvrId}/delete`, { method: "POST" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Cameras</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
            NVR camera channels, discovered and previewed over ONVIF.
          </p>
        </div>
        {devices.length > 0 && (
          <button className="submit" style={{ width: "auto", marginTop: 0, padding: "0.5rem 1rem" }} onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Cancel" : "Add NVR"}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="dash-panel" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Add an NVR</h2>

          <button
            type="button"
            className="submit"
            style={{ width: "auto", padding: "0.4rem 0.9rem", fontSize: "0.82rem", marginBottom: "1rem" }}
            onClick={handleScan}
            disabled={scanning}
          >
            <span className="flex items-center gap-2">
              <Radar size={14} />
              {scanning ? "Scanning network..." : "Scan network for NVR/cameras"}
            </span>
          </button>

          {scanError && <p style={{ color: "var(--warning, #d97706)", fontSize: "0.82rem" }}>{scanError}</p>}

          {discovered && discovered.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Found on this network:</p>
              {discovered.map((d) => (
                <button
                  key={d.address}
                  type="button"
                  onClick={() => {
                    // Prefill port/ONVIF path from the device's own advertised address too  - 
                    // not every device uses the default 80/device_service (this NVR, for
                    // instance, answers on 8080 at /onvif/devices).
                    try {
                      const url = new URL(d.xaddrs[0]);
                      setForm((f) => ({
                        ...f,
                        ipAddress: d.address,
                        port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
                        onvifPath: url.pathname || f.onvifPath,
                      }));
                    } catch {
                      setForm((f) => ({ ...f, ipAddress: d.address }));
                    }
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.4rem",
                    borderRadius: 8,
                    border: form.ipAddress === d.address ? "1px solid var(--series-1)" : "1px solid var(--border)",
                    background: "var(--surface-2)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  {d.address}
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{d.xaddrs[0]}</div>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleAddNvr}>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "0.75rem" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="nvr-name">Name</label>
                <input id="nvr-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main Office NVR" required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="nvr-ip">IP address</label>
                <input id="nvr-ip" value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} placeholder="192.168.1.50" required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="nvr-port">Port</label>
                <input id="nvr-port" type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="nvr-user">Username</label>
                <input id="nvr-user" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="nvr-pass">Password</label>
                <input id="nvr-pass" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="nvr-path">ONVIF path</label>
                <input id="nvr-path" value={form.onvifPath} onChange={(e) => setForm((f) => ({ ...f, onvifPath: e.target.value }))} />
              </div>
            </div>
            {saveError && <div className="error">{saveError}</div>}
            <button className="submit" type="submit" disabled={saving} style={{ width: "auto", padding: "0.5rem 1.25rem" }}>
              {saving ? "Connecting..." : "Save and connect"}
            </button>
          </form>
        </div>
      )}

      {devices.length > 0 && (
        <div className="dash-panel" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginTop: 0 }}>NVR Devices</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>IP Address</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Cameras</th>
                <th style={{ padding: "0.5rem" }}>Last Synced</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>{d.Name}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {d.IpAddress}:{d.Port}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <Badge tone={statusTone(d.Status)}>{d.Status}</Badge>
                    {d.LastError && <div style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: "0.2rem" }}>{d.LastError}</div>}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{d.CameraCount}</td>
                  <td style={{ padding: "0.5rem" }}>{d.LastSyncedAt ? new Date(d.LastSyncedAt).toLocaleString() : "Never"}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      onClick={() => handleSync(d.Id)}
                      disabled={syncingId === d.Id}
                      title="Re-sync cameras"
                      style={{ background: "none", border: "none", color: "var(--series-1)", cursor: "pointer", marginRight: "0.5rem" }}
                    >
                      <RefreshCw size={15} style={{ animation: syncingId === d.Id ? "spin 0.8s linear infinite" : undefined }} />
                    </button>
                    <button onClick={() => handleDelete(d.Id)} title="Remove NVR" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>
          Camera Channels {cameras.length > 0 && `(${cameras.length})`}
        </h2>
        {cameras.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            {devices.length === 0 ? "Add an NVR above to start showing its camera channels here." : "No camera channels found yet  -  try Re-sync."}
          </p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {cameras.map((cam) => (
              <div
                key={cam.Id}
                onClick={() => setLiveCamera(cam)}
                draggable
                onDragStart={() => setDraggedId(cam.Id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(cam.Id);
                }}
                onDragEnd={() => setDraggedId(null)}
                style={{
                  border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface-2)", cursor: "grab",
                  opacity: draggedId === cam.Id ? 0.4 : 1,
                }}
              >
                <div className="camera-tile-preview" style={{ position: "relative", aspectRatio: "16 / 9", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img
                    src={`/api/admin/nvr/cameras/${cam.Id}/thumbnail?t=${thumbnailTick}`}
                    alt={cam.Label || cam.ChannelName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/camera-placeholder.svg";
                    }}
                  />
                  <div
                    className="camera-tile-play"
                    style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.35)", opacity: 0, transition: "opacity 0.15s",
                    }}
                  >
                    <Play size={32} style={{ color: "#fff" }} />
                  </div>
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: "0.35rem" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaybackCamera(cam);
                      }}
                      title="Playback recording"
                      style={{
                        background: "rgba(0,0,0,0.5)", border: "none",
                        borderRadius: 6, padding: "0.3rem", cursor: "pointer", color: "#fff",
                      }}
                    >
                      <History size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openLabelEditor(cam);
                      }}
                      title="Edit name/location"
                      style={{
                        background: "rgba(0,0,0,0.5)", border: "none",
                        borderRadius: 6, padding: "0.3rem", cursor: "pointer", color: "#fff",
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ padding: "0.6rem 0.75rem" }}>
                  <div className="flex items-center gap-2" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>
                    <CameraIcon size={14} style={{ color: "var(--ink-muted)" }} />
                    {cam.Label || cam.ChannelName}
                  </div>
                  {cam.Location && (
                    <div className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.15rem" }}>
                      <MapPin size={11} />
                      {cam.Location}
                    </div>
                  )}
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.15rem" }}>{cam.NvrName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {liveCamera && (
        <LiveViewModal cameraId={liveCamera.Id} channelName={liveCamera.Label || liveCamera.ChannelName} onClose={() => setLiveCamera(null)} />
      )}

      {playbackCamera && (
        <PlaybackModal cameraId={playbackCamera.Id} channelName={playbackCamera.Label || playbackCamera.ChannelName} onClose={() => setPlaybackCamera(null)} />
      )}

      {editingCamera && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
          }}
          onClick={() => setEditingCamera(null)}
        >
          <div className="card" style={{ maxWidth: 380, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", margin: 0 }}>Edit Camera</h2>
              <button onClick={() => setEditingCamera(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveLabel}>
              <div className="field">
                <label htmlFor="cam-label">Name</label>
                <input
                  id="cam-label"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder={editingCamera.ChannelName}
                />
              </div>
              <div className="field">
                <label htmlFor="cam-location">Location</label>
                <input
                  id="cam-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Front Door, Warehouse"
                />
              </div>
              <button className="submit" type="submit" disabled={savingLabel} style={{ width: "auto", padding: "0.5rem 1.25rem" }}>
                {savingLabel ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .camera-tile-preview:hover .camera-tile-play { opacity: 1; }
      `}</style>
    </div>
  );
}
