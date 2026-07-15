"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  DepartmentId: number | null;
  TeamId: number | null;
  BranchOfficeId: number | null;
  JobDesignationId: number | null;
}

interface OrgOption {
  Id: number;
  Name?: string;
  Title?: string;
}

async function fetchOptions(path: string): Promise<OrgOption[]> {
  try {
    const res = await fetch(path);
    const data = await res.json();
    return res.ok && data.ok ? data.data : [];
  } catch {
    return [];
  }
}

export function EditEmployeeModal({ employee, onClose }: { employee: EditableEmployee; onClose: () => void }) {
  const t = useTranslations("employees.editModal");
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: employee.Name,
    email: employee.Email ?? "",
    phone: employee.Phone ?? "",
    address: employee.Address ?? "",
    departmentId: employee.DepartmentId ?? "",
    teamId: employee.TeamId ?? "",
    branchOfficeId: employee.BranchOfficeId ?? "",
    jobDesignationId: employee.JobDesignationId ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee.PhotoPath);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [teams, setTeams] = useState<OrgOption[]>([]);
  const [branchOffices, setBranchOffices] = useState<OrgOption[]>([]);
  const [jobDesignations, setJobDesignations] = useState<OrgOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchOptions("/api/admin/settings/organization/departments"),
      fetchOptions("/api/admin/settings/organization/teams"),
      fetchOptions("/api/admin/settings/organization/branch-offices"),
      fetchOptions("/api/admin/settings/organization/job-designations"),
    ]).then(([d, tm, b, j]) => {
      setDepartments(d);
      setTeams(tm);
      setBranchOffices(b);
      setJobDesignations(j);
      setOptionsLoading(false);
    });
  }, []);

  function onPhotoChange(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : employee.PhotoPath);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.show({ type: "error", message: t("nameRequiredError") });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${employee.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          departmentId: form.departmentId || null,
          teamId: form.teamId || null,
          branchOfficeId: form.branchOfficeId || null,
          jobDesignationId: form.jobDesignationId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));

      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        const photoRes = await fetch(`/api/admin/staff/${employee.Id}/photo`, { method: "POST", body: fd });
        const photoData = await photoRes.json();
        if (!photoRes.ok || !photoData.ok) throw new Error(photoData.error ?? t("photoUploadFailedError"));
      }

      toast.show({ type: "success", message: t("employeeUpdatedToast") });
      router.refresh();
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericErrorToast") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("title")}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {t("cancelButton")}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? t("savingButton") : t("saveChangesButton")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={form.name || "?"} photoPath={photoPreview} size={56} />
          <div>
            <label style={labelStyle}>{t("profilePhotoLabel")}</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
              style={{ fontSize: "0.8rem" }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t("fullNameLabel")}</label>
          <input style={fieldStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>{t("emailLabel")}</label>
            <input
              style={fieldStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>{t("cellNumberLabel")}</label>
            <input style={fieldStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+977 98XXXXXXXX" />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>{t("departmentLabel")}</label>
            <select
              style={fieldStyle}
              value={form.departmentId}
              disabled={optionsLoading}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">{t("noneOption")}</option>
              {departments.map((d) => (
                <option key={d.Id} value={d.Id}>
                  {d.Name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t("teamLabel")}</label>
            <select
              style={fieldStyle}
              value={form.teamId}
              disabled={optionsLoading}
              onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
            >
              <option value="">{t("noneOption")}</option>
              {teams.map((tm) => (
                <option key={tm.Id} value={tm.Id}>
                  {tm.Name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>{t("branchOfficeLabel")}</label>
            <select
              style={fieldStyle}
              value={form.branchOfficeId}
              disabled={optionsLoading}
              onChange={(e) => setForm((f) => ({ ...f, branchOfficeId: e.target.value }))}
            >
              <option value="">{t("noneOption")}</option>
              {branchOffices.map((b) => (
                <option key={b.Id} value={b.Id}>
                  {b.Name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t("positionLabel")}</label>
            <select
              style={fieldStyle}
              value={form.jobDesignationId}
              disabled={optionsLoading}
              onChange={(e) => setForm((f) => ({ ...f, jobDesignationId: e.target.value }))}
            >
              <option value="">{t("noneOption")}</option>
              {jobDesignations.map((j) => (
                <option key={j.Id} value={j.Id}>
                  {j.Title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t("addressLabel")}</label>
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
