"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export interface ContactMessageRow {
  Id: number;
  Name: string;
  Email: string;
  Phone: string | null;
  Subject: string | null;
  Message: string;
  CreatedAt: string;
  ReadAt: string | null;
}

function MessageCard({ message }: { message: ContactMessageRow }) {
  const router = useRouter();

  async function markRead() {
    await fetch(`/api/admin/website/contact-messages/${message.Id}`, { method: "PATCH" });
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <strong style={{ color: "var(--ink)" }}>{message.Subject || "(no subject)"}</strong>
          <div style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
            {message.Name} &lt;{message.Email}&gt;
            {message.Phone ? ` · ${message.Phone}` : ""} · {message.CreatedAt.replace("T", " ")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {message.ReadAt ? (
            <Badge tone="neutral">Read</Badge>
          ) : (
            <>
              <Badge tone="info">Unread</Badge>
              <Button size="sm" variant="secondary" onClick={markRead}>
                Mark read
              </Button>
            </>
          )}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--ink)" }}>{message.Message}</p>
    </Card>
  );
}

export function ContactMessagesAdmin({ messages }: { messages: ContactMessageRow[] }) {
  if (messages.length === 0) {
    return (
      <Card>
        <p style={{ color: "var(--ink-muted)", margin: 0 }}>No contact messages yet.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <MessageCard key={m.Id} message={m} />
      ))}
    </div>
  );
}
