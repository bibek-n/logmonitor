import { Suspense } from "react";
import { getCqAccess } from "@/lib/requireCodeQualityPermission";
import { getDb } from "@/lib/db";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { IssuesListClient } from "@/components/codeQuality/IssuesListClient";

export const dynamic = "force-dynamic";

export default async function CodeQualityIssuesPage() {
  const { cq, can } = await getCqAccess();
  if (!cq) return <NotAuthorized />;

  const db = await getDb();
  const projects = await db.query`SELECT Id, Name FROM CodeQualityProjects WHERE DeletedAt IS NULL ORDER BY Name`;

  return (
    <Suspense fallback={null}>
      <IssuesListClient can={can} projects={projects.recordset} />
    </Suspense>
  );
}
