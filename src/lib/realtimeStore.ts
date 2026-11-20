import { create } from "zustand";

// Shared "something changed, go check now" signal fed by RealtimeEventsProvider's single SSE
// connection (see src/app/api/admin/events/route.ts) - every counter here is a nudge, never the
// actual data, so each consuming component (HeaderClient, Sidebar, FloatingChatWidget, ...)
// keeps using its own existing, already-tested fetch function as the real source of truth. A
// consumer reacts by depending on the relevant counter in a useEffect and re-running its fetch
// when it changes, in addition to keeping its own (now much less frequent) poll as a fallback.
interface RealtimeState {
  alertsNudge: number;
  chatNudge: number;
  lastChatStaffId: number | null;
  connected: boolean;
  bumpAlerts: () => void;
  bumpChat: (staffId: number) => void;
  setConnected: (v: boolean) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  alertsNudge: 0,
  chatNudge: 0,
  lastChatStaffId: null,
  connected: false,
  bumpAlerts: () => set((s) => ({ alertsNudge: s.alertsNudge + 1 })),
  bumpChat: (staffId) => set((s) => ({ chatNudge: s.chatNudge + 1, lastChatStaffId: staffId })),
  setConnected: (v) => set({ connected: v }),
}));
