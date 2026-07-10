"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Trash2, Eye, Pencil, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export interface SlideRow {
  Id: number;
  Title: string | null;
  Subtitle: string | null;
  ButtonText: string | null;
  ButtonUrl: string | null;
  ImagePath: string;
  SortOrder: number;
  Enabled: boolean;
  PublishStartAt: string | null;
  PublishEndAt: string | null;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function SlideFields({
  title,
  setTitle,
  subtitle,
  setSubtitle,
  buttonText,
  setButtonText,
  buttonUrl,
  setButtonUrl,
  publishStartAt,
  setPublishStartAt,
  publishEndAt,
  setPublishEndAt,
}: {
  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  buttonText: string;
  setButtonText: (v: string) => void;
  buttonUrl: string;
  setButtonUrl: (v: string) => void;
  publishStartAt: string;
  setPublishStartAt: (v: string) => void;
  publishEndAt: string;
  setPublishEndAt: (v: string) => void;
}) {
  return (
    <>
      <input style={fieldStyle} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input style={fieldStyle} placeholder="Subtitle / description" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <input style={fieldStyle} placeholder="Button text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
        <input style={fieldStyle} placeholder="Button URL" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Publish start (optional)</label>
          <input style={fieldStyle} type="datetime-local" value={publishStartAt} onChange={(e) => setPublishStartAt(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Publish end (optional)</label>
          <input style={fieldStyle} type="datetime-local" value={publishEndAt} onChange={(e) => setPublishEndAt(e.target.value)} />
        </div>
      </div>
    </>
  );
}

function CreateSlideForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [publishStartAt, setPublishStartAt] = useState("");
  const [publishEndAt, setPublishEndAt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!image) {
      setError("An image is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("subtitle", subtitle);
    formData.append("buttonText", buttonText);
    formData.append("buttonUrl", buttonUrl);
    formData.append("publishStartAt", publishStartAt);
    formData.append("publishEndAt", publishEndAt);
    formData.append("image", image);

    try {
      const res = await fetch("/api/admin/website/slider", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to create slide.");
        return;
      }
      setTitle("");
      setSubtitle("");
      setButtonText("");
      setButtonUrl("");
      setPublishStartAt("");
      setPublishEndAt("");
      setImage(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Add New Slide</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <SlideFields
          title={title}
          setTitle={setTitle}
          subtitle={subtitle}
          setSubtitle={setSubtitle}
          buttonText={buttonText}
          setButtonText={setButtonText}
          buttonUrl={buttonUrl}
          setButtonUrl={setButtonUrl}
          publishStartAt={publishStartAt}
          setPublishStartAt={setPublishStartAt}
          publishEndAt={publishEndAt}
          setPublishEndAt={setPublishEndAt}
        />
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        {error && <div style={{ color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}
        <Button type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Uploading..." : "Add Slide"}
        </Button>
      </form>
    </Card>
  );
}

function SlideItem({ slide }: { slide: SlideRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(slide.Title ?? "");
  const [subtitle, setSubtitle] = useState(slide.Subtitle ?? "");
  const [buttonText, setButtonText] = useState(slide.ButtonText ?? "");
  const [buttonUrl, setButtonUrl] = useState(slide.ButtonUrl ?? "");
  const [publishStartAt, setPublishStartAt] = useState(slide.PublishStartAt?.slice(0, 16) ?? "");
  const [publishEndAt, setPublishEndAt] = useState(slide.PublishEndAt?.slice(0, 16) ?? "");
  const [saving, setSaving] = useState(false);

  async function toggleEnabled() {
    const formData = new FormData();
    formData.append("title", slide.Title ?? "");
    formData.append("subtitle", slide.Subtitle ?? "");
    formData.append("buttonText", slide.ButtonText ?? "");
    formData.append("buttonUrl", slide.ButtonUrl ?? "");
    formData.append("publishStartAt", slide.PublishStartAt ?? "");
    formData.append("publishEndAt", slide.PublishEndAt ?? "");
    formData.append("enabled", (!slide.Enabled).toString());
    await fetch(`/api/admin/website/slider/${slide.Id}`, { method: "PATCH", body: formData });
    router.refresh();
  }

  async function saveEdit() {
    setSaving(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("subtitle", subtitle);
    formData.append("buttonText", buttonText);
    formData.append("buttonUrl", buttonUrl);
    formData.append("publishStartAt", publishStartAt);
    formData.append("publishEndAt", publishEndAt);
    formData.append("enabled", slide.Enabled.toString());
    try {
      await fetch(`/api/admin/website/slider/${slide.Id}`, { method: "PATCH", body: formData });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this slide? This cannot be undone.")) return;
    await fetch(`/api/admin/website/slider/${slide.Id}`, { method: "DELETE" });
    router.refresh();
  }

  async function move(direction: "up" | "down") {
    await fetch(`/api/admin/website/slider/${slide.Id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex gap-3">
        <img src={slide.ImagePath} alt={slide.Title ?? "Slide"} style={{ width: 120, height: 70, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <strong style={{ color: "var(--ink)" }}>{slide.Title || "(no title)"}</strong>
            <Badge tone={slide.Enabled ? "success" : "neutral"}>{slide.Enabled ? "Enabled" : "Disabled"}</Badge>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>{slide.Subtitle}</p>
        </div>
        <div className="flex flex-col gap-1" style={{ flexShrink: 0 }}>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => move("up")} title="Move up">
              <ArrowUp size={13} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => move("down")} title="Move down">
              <ArrowDown size={13} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} title="Edit">
              <Pencil size={13} />
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleEnabled} title={slide.Enabled ? "Disable" : "Enable"}>
              <Eye size={13} />
            </Button>
            <Button size="sm" variant="danger" onClick={remove} title="Delete">
              <Trash2 size={13} />
            </Button>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--primary)" }}>
            <ExternalLink size={12} /> Preview
          </a>
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <SlideFields
            title={title}
            setTitle={setTitle}
            subtitle={subtitle}
            setSubtitle={setSubtitle}
            buttonText={buttonText}
            setButtonText={setButtonText}
            buttonUrl={buttonUrl}
            setButtonUrl={setButtonUrl}
            publishStartAt={publishStartAt}
            setPublishStartAt={setPublishStartAt}
            publishEndAt={publishEndAt}
            setPublishEndAt={setPublishEndAt}
          />
          <Button size="sm" onClick={saveEdit} disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function SliderAdmin({ slides }: { slides: SlideRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <CreateSlideForm />
      {slides.length === 0 ? (
        <Card>
          <p style={{ color: "var(--ink-muted)", margin: 0 }}>No slides yet — add one above.</p>
        </Card>
      ) : (
        slides.map((s) => <SlideItem key={s.Id} slide={s} />)
      )}
    </div>
  );
}
