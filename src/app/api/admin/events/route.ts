import { NextRequest } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { subscribeRealtimeEvents } from "@/lib/realtime/eventBus";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25000;

// Server-Sent Events stream for instant dashboard pushes (new alert, new chat message) - see
// src/lib/realtime/eventBus.ts for why SSE over WebSocket. Each connected browser tab holds one
// of these open via src/components/RealtimeEventsProvider.tsx, mounted once in DashShellClient;
// HeaderClient/Sidebar/FloatingChatWidget all listen for a matching event and re-run their
// existing fetch immediately. This stream only ever carries a *signal* (event type, plus a
// staffId for chat so only the relevant open thread refetches), never the actual alert/message
// data - the existing, already-tested fetch paths stay the single source of truth for what's
// shown, this just tells them "go check now" instead of waiting for the next poll tick.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller already closed (client disconnected mid-write) - the abort listener
          // below handles cleanup.
        }
      };

      unsubscribe = subscribeRealtimeEvents((event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });
      heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
