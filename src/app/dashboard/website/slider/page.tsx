import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { SliderAdmin, type SlideRow } from "@/components/website/SliderAdmin";

export const dynamic = "force-dynamic";

export default async function SliderAdminPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Slider Management</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can manage the homepage slider.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<SlideRow>(`
    SELECT Id, Title, Subtitle, ButtonText, ButtonUrl, ImagePath, SortOrder, Enabled,
      CONVERT(VARCHAR(19), PublishStartAt, 126) AS PublishStartAt,
      CONVERT(VARCHAR(19), PublishEndAt, 126) AS PublishEndAt
    FROM SliderImages
    ORDER BY SortOrder ASC
  `);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Slider Management</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Manages the image slider shown on the public homepage. Only enabled slides within their publish window
        (if set) appear live.
      </p>
      <SliderAdmin slides={result.recordset} />
    </div>
  );
}
