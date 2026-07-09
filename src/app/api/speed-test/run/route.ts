import { NextRequest, NextResponse } from "next/server";
import { isValidTarget } from "@/lib/networkTools";
import { runSpeedTestStreaming, SpeedTestCategory } from "@/lib/speedTest";

const VALID_CATEGORIES: SpeedTestCategory[] = ["nepal", "international", "local-ip"];

export async function POST(req: NextRequest) {
  const { target, category } = await req.json();
  if (typeof target !== "string" || !target) {
    return NextResponse.json({ ok: false, error: "Target is required." }, { status: 400 });
  }
  const cat: SpeedTestCategory = VALID_CATEGORIES.includes(category) ? category : "local-ip";

  const host = target.includes("://")
    ? (() => {
        try {
          return new URL(target).hostname;
        } catch {
          return "";
        }
      })()
    : target;

  if (!host || !isValidTarget(host)) {
    return NextResponse.json({ ok: false, error: "Invalid target — enter a URL or an IP/hostname." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        await runSpeedTestStreaming(target, cat, send);
      } catch (err) {
        send({ phase: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
