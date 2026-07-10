"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.83rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" };

export interface EditableEmployee {
  Id: number;
  Name: string;
  Email: string | null;
  Phone: string | null;
  Department: string | null;
  Position: string | null;
  Address: string | null;
  PhotoPath: string | null;
}

export function EditEmployeeModal({ employee, onClose }: { employee: EditableEmployee; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: employee.Name,
    email: employee.Email ?? "",
    phone: employee.Phone ?? "",
    department: employee.Department ?? "",
    position: employee.Position ?? "",
    address: employee.Address ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee.PhotoPath);
  const [saving, setSaving] = useState(false);

  function onPhotoChange(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : employee.PhotoPath);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.show({ type: "error", message: "Name is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${employee.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save");

      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        const photoRes = await fetch(`/api/admin/staff/${employee.Id}/photo`, { method: "POST", body: fd });
        const photoData = await photoRes.json();
        if (!photoRes.ok || !photoData.ok) throw new Error(photoData.error ?? "Photo upload failed");
      }

      toast.show({ type: "success", message: "Employee updated." });
      router.refresh();
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Employee"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={form.name || "?"} photoPath={photoPreview} size={56} />
          <div>
            <label style={labelStyle}>Profile Photo</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
              style={{ fontSize: "0.8rem" }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Full Name</label>
          <input style={fieldStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={fieldStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Cell Number</label>
            <input style={fieldStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+977 98XXXXXXXX" />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>Department</label>
            <input style={fieldStyle} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Position</label>
            <input style={fieldStyle} value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Address</label>
          <textarea
            style={{ ...fieldStyle, resize: "vertical" }}
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}
