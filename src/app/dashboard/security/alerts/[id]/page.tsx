import AlertDetailClient from "@/components/intrusionDetection/AlertDetailClient";

export const dynamic = "force-dynamic";

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlertDetailClient alertId={Number(id)} />;
}
