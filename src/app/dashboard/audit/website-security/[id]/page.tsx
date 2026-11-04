import { WebsiteSecurityDetailClient } from "@/components/websiteSecurity/WebsiteSecurityDetailClient";

export const dynamic = "force-dynamic";

export default async function WebsiteSecurityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const websiteId = Number(id);

  return <WebsiteSecurityDetailClient websiteId={websiteId} />;
}
