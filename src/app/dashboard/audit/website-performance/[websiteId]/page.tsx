import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import WebsitePerformanceDetailClient from "@/components/websitePerformance/WebsitePerformanceDetailClient";

export const dynamic = "force-dynamic";

export default async function WebsitePerformanceDetailPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) notFound();

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, websiteId).query<{ Id: number; Name: string; Url: string; Enabled: boolean }>(
    "SELECT Id, Name, Url, Enabled FROM Websites WHERE Id = @id"
  );
  const website = result.recordset[0];
  if (!website) notFound();

  return <WebsitePerformanceDetailClient website={website} />;
}
