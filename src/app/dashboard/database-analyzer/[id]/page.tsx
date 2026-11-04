import { DatabaseAnalyzerDetailClient } from "@/components/databaseAnalyzer/DatabaseAnalyzerDetailClient";

export const dynamic = "force-dynamic";

export default async function DatabaseAnalyzerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DatabaseAnalyzerDetailClient connectionId={Number(id)} />;
}
