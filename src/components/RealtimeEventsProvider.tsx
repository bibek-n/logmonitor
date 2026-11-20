"use client";

import { useEffect } from "react";
import { useRealtimeStore } from "@/lib/realtimeStore";
import type { RealtimeEvent } from "@/lib/realtime/eventBus";

// Opens ONE shared EventSource for the whole dashboard shell (instead of each bell/widget
// opening its own) so a new alert or chat message nudges every interested component to re-run
// its existing fetch immediately, instead of waiting out its poll interval - see
// src/lib/realtimeStore.ts. EventSource reconnects on its own after a drop (e.g. an idle
// connection getting recycled by iisnode), with the browser's built-in backoff - nothing extra
// needed here for that. Mounted once in DashShellClient.
export default function RealtimeEventsProvider() {
  useEffect(() => {
    const { setConnected, bumpAlerts, bumpChat } = useRealtimeStore.getState();

    const source = new EventSource("/api/admin/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as RealtimeEvent;
        if (event.type === "alert") bumpAlerts();
        else if (event.type === "chat-message") bumpChat(event.staffId);
      } catch {
        // Not a JSON event payload (shouldn't happen - heartbeats are sent as comments, which
        // EventSource never surfaces as a message at all) - ignore defensively either way.
      }
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, []);

  return null;
}
