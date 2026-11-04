import { WordPressScanDetailClient } from "@/components/wordpressScan/WordPressScanDetailClient";

export const dynamic = "force-dynamic";

export default async function WordPressScanDetailPage({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  return <WordPressScanDetailClient scanId={Number(scanId)} />;
}
