import { EventEmitter } from "node:events";

export type RealtimeEvent = { type: "alert" } | { type: "chat-message"; staffId: number };

// In-process pub/sub for instant dashboard pushes (new alert, new chat message), consumed over
// Server-Sent Events - see src/app/api/admin/events/route.ts. Deliberately in-memory, not a
// message queue/Redis channel: this app runs as a single iisnode-hosted Node process (web.config
// has no nodeProcessCountPerApplication override, which otherwise defaults to 1), and two other
// features in this codebase already chose HTTP long-polling over WebSocket specifically because
// IIS/iisnode isn't well suited to persistent-connection infra - see
// src/lib/remoteSupport/signalingRelay.ts's own comment to that effect. Every client-side
// consumer keeps its existing poll as a fallback (just at a much longer interval now - see each
// component), so an unexpected multi-process deployment or a process recycle degrades to "a bit
// slower", never "broken".
const emitter = new EventEmitter();
// One listener per open admin dashboard tab (one SSE connection each) - comfortably above any
// realistic concurrent-admin count, just raised from Node's default of 10 to avoid a
// MaxListenersExceededWarning in normal use.
emitter.setMaxListeners(200);

const CHANNEL = "event";

export function publishRealtimeEvent(event: RealtimeEvent): void {
  emitter.emit(CHANNEL, event);
}

export function subscribeRealtimeEvents(onEvent: (event: RealtimeEvent) => void): () => void {
  emitter.on(CHANNEL, onEvent);
  return () => emitter.off(CHANNEL, onEvent);
}
