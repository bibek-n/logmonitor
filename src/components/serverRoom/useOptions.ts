"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/apiFetch";

export interface SrOptions {
  staff: { id: number; name: string }[];
  devices: { deviceId: string; label: string; os: string | null; type: string }[];
  activeEntries: { id: number; staffId: number | null; staffName: string }[];
}

// Staff / device / currently-inside choices for the Server Room forms.
export function useServerRoomOptions() {
  const [options, setOptions] = useState<SrOptions>({ staff: [], devices: [], activeEntries: [] });
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/admin/server-room/options");
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: SrOptions };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to load form options");
      setOptions(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load form options");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return { options, error, reload };
}

export async function postJson(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; [k: string]: unknown };
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Request failed");
  return json;
}
