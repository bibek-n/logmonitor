"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { KB_CATEGORIES } from "@/lib/knowledgeBase/constants";
import { inputStyle, th, td } from "@/components/securityUpdates/shared";

interface DocumentRow {
  id: number;
  title: string;
  description: string | null;
  category: string;
  tags: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The Category dropdown offers the 8 presets plus this sentinel, which swaps in a free-text
// input - the server accepts any non-empty value up to 50 characters (see the route's
// validCategory), not just the preset list, matching Server Room's reason/task field.
const CUSTOM_CATEGORY_VALUE = "__custom__";

interface EditForm {
  title: string;
  description: string;
  category: string;
  customCategory: string;
  tags: string;
  file: File | null;
}

export function KnowledgeBaseClient({ canManage }: { canManage: boolean }) {
  const toast = useToast();

  // upload form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(0); // bumped to reset the file input after a successful upload

  // list
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryQ, setCategoryQ] = useState("");

  // edit / delete
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (q.trim()) p.set("q", q.trim());
      if (categoryQ) p.set("category", categoryQ);
      const res = await fetch(`/api/admin/knowledge-base/documents?${p.toString()}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: DocumentRow[]; total?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load documents");
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load documents." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload() {
    const effectiveCategory = category === CUSTOM_CATEGORY_VALUE ? customCategory.trim() : category;
    if (!title.trim() || !effectiveCategory || !file) {
      toast.show({ type: "error", message: "Title, category and a file are all required." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("category", effectiveCategory);
      if (description.trim()) fd.set("description", description.trim());
      if (tags.trim()) fd.set("tags", tags.trim());
      fd.set("file", file);
      const res = await fetch("/api/admin/knowledge-base/documents", { method: "POST", body: fd });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Upload failed");
      toast.show({ type: "success", message: "Document uploaded." });
      setTitle("");
      setDescription("");
      setCategory("");
      setCustomCategory("");
      setTags("");
      setFile(null);
      setUploadKey((k) => k + 1);
      await load(1);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  function startEdit(r: DocumentRow) {
    setEditingId(r.id);
    const isPreset = (KB_CATEGORIES as readonly string[]).includes(r.category);
    setEditForm({
      title: r.title,
      description: r.description ?? "",
      category: isPreset ? r.category : CUSTOM_CATEGORY_VALUE,
      customCategory: isPreset ? "" : r.category,
      tags: r.tags ?? "",
      file: null,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id: number) {
    if (!editForm) return;
    if (!editForm.title.trim()) {
      toast.show({ type: "error", message: "Title cannot be empty." });
      return;
    }
    const effectiveCategory = editForm.category === CUSTOM_CATEGORY_VALUE ? editForm.customCategory.trim() : editForm.category;
    if (!effectiveCategory) {
      toast.show({ type: "error", message: "Enter a category." });
      return;
    }
    setSavingEdit(true);
    try {
      const fd = new FormData();
      fd.set("title", editForm.title.trim());
      fd.set("category", effectiveCategory);
      fd.set("description", editForm.description.trim());
      fd.set("tags", editForm.tags.trim());
      if (editForm.file) fd.set("file", editForm.file);
      const res = await fetch(`/api/admin/knowledge-base/documents/${id}`, { method: "PATCH", body: fd });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to update the document");
      toast.show({ type: "success", message: "Document updated." });
      setEditingId(null);
      setEditForm(null);
      await load(page);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to update the document." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeDoc(r: DocumentRow) {
    if (!window.confirm(`Delete "${r.title}" (${r.fileName})? This cannot be undone.`)) return;
    setDeletingId(r.id);
    try {
      const res = await fetch(`/api/admin/knowledge-base/documents/${r.id}`, { method: "DELETE" });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to delete the document");
      toast.show({ type: "success", message: "Document deleted." });
      if (editingId === r.id) cancelEdit();
      await load(page);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete the document." });
    } finally {
      setDeletingId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0, maxWidth: 720 }}>
        Configuration notes, troubleshooting guides, network/server documentation and anything else IT-related that a new hire would
        need if the person who set something up were no longer around. Upload PDF, Word, Excel, PowerPoint, text/CSV, image or zip files.
      </p>

      {canManage && (
        <Card className="flex flex-col gap-3">
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Upload a document</h2>
          <div className="flex flex-wrap gap-3">
            <input style={{ ...inputStyle, minWidth: 240, flex: 1 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <select style={{ ...inputStyle, minWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Category...</option>
              {KB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY_VALUE}>+ Add a new category...</option>
            </select>
            {category === CUSTOM_CATEGORY_VALUE && (
              <input style={{ ...inputStyle, minWidth: 200 }} placeholder="Type the new category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} maxLength={50} />
            )}
            <input style={{ ...inputStyle, minWidth: 200 }} placeholder="Tags (optional, comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={300} />
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 64, width: "100%" }}
            placeholder="Description (optional) - what this document covers, when it applies"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input key={uploadKey} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button onClick={upload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Max 25 MB.</span>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Documents</h2>
        <div className="flex flex-wrap gap-3">
          <input style={{ ...inputStyle, minWidth: 240 }} placeholder="Search title, description, tags, file name" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <select style={inputStyle} value={categoryQ} onChange={(e) => setCategoryQ(e.target.value)}>
            <option value="">Any category</option>
            {KB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </Button>
        </div>

        {rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>{loading ? "Loading..." : "No documents match."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Title", "Category", "Tags", "File", "Uploaded by", "Updated", "Actions"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr key={r.id} style={{ borderBottom: editingId === r.id ? "none" : "1px solid var(--border)", verticalAlign: "top" }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        {r.description && <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)", maxWidth: 320 }}>{r.description}</div>}
                      </td>
                      <td style={td}>{r.category}</td>
                      <td style={{ ...td, color: "var(--ink-muted)" }}>{r.tags ?? ""}</td>
                      <td style={td}>
                        {/* PDFs/images/text open inline in a new tab (see resolveKbDocumentServing); the
                            explicit Download button below always forces a real download via ?download=1. */}
                        <a href={`/api/admin/knowledge-base/documents/${r.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--link, #2563eb)" }}>
                          {r.fileName}
                        </a>
                        <div style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>{formatSize(r.sizeBytes)}</div>
                      </td>
                      <td style={td}>{r.uploadedBy ?? "-"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{formatUtcTimestamp(r.updatedAt)}</td>
                      <td style={td}>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => window.open(`/api/admin/knowledge-base/documents/${r.id}?download=1`, "_blank")}>
                            Download
                          </Button>
                          {canManage && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => (editingId === r.id ? cancelEdit() : startEdit(r))}>
                                {editingId === r.id ? "Cancel" : "Edit"}
                              </Button>
                              <Button size="sm" variant="danger" disabled={deletingId === r.id} onClick={() => removeDoc(r)}>
                                {deletingId === r.id ? "Deleting..." : "Delete"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === r.id && editForm && (
                      <tr key={`${r.id}-edit`} style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-muted, rgba(127,127,127,0.06))" }}>
                        <td colSpan={7} style={{ ...td, padding: "10px 6px" }}>
                          <div className="flex flex-wrap items-end gap-3">
                            <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", minWidth: 200 }}>
                              Title
                              <input style={{ ...inputStyle, display: "block", marginTop: 2 }} value={editForm.title} onChange={(e) => setEditForm((f) => (f ? { ...f, title: e.target.value } : f))} maxLength={200} />
                            </label>
                            <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", minWidth: 200 }}>
                              Category
                              <select style={{ ...inputStyle, display: "block", marginTop: 2 }} value={editForm.category} onChange={(e) => setEditForm((f) => (f ? { ...f, category: e.target.value } : f))}>
                                {KB_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                                <option value={CUSTOM_CATEGORY_VALUE}>+ Add a new category...</option>
                              </select>
                            </label>
                            {editForm.category === CUSTOM_CATEGORY_VALUE && (
                              <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", minWidth: 180 }}>
                                New category
                                <input
                                  style={{ ...inputStyle, display: "block", marginTop: 2 }}
                                  value={editForm.customCategory}
                                  onChange={(e) => setEditForm((f) => (f ? { ...f, customCategory: e.target.value } : f))}
                                  maxLength={50}
                                />
                              </label>
                            )}
                            <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", minWidth: 180 }}>
                              Tags
                              <input style={{ ...inputStyle, display: "block", marginTop: 2 }} value={editForm.tags} onChange={(e) => setEditForm((f) => (f ? { ...f, tags: e.target.value } : f))} maxLength={300} />
                            </label>
                            <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", flex: 1, minWidth: 220 }}>
                              Description
                              <textarea
                                style={{ ...inputStyle, display: "block", marginTop: 2, minHeight: 40, width: "100%" }}
                                value={editForm.description}
                                onChange={(e) => setEditForm((f) => (f ? { ...f, description: e.target.value } : f))}
                                maxLength={2000}
                              />
                            </label>
                            <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                              Replace file (optional)
                              <input
                                type="file"
                                style={{ display: "block", marginTop: 2 }}
                                onChange={(e) => setEditForm((f) => (f ? { ...f, file: e.target.files?.[0] ?? null } : f))}
                              />
                            </label>
                            <Button size="sm" onClick={() => saveEdit(r.id)} disabled={savingEdit}>
                              {savingEdit ? "Saving..." : "Save"}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={savingEdit}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} document{total === 1 ? "" : "s"})
          </span>
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
