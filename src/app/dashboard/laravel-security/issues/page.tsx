import { Suspense } from "react";
import { getLsAccess } from "@/lib/requireLaravelSecurityPermission";
import { getDb } from "@/lib/db";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { IssuesListClient } from "@/components/laravelSecurity/IssuesListClient";

export const dynamic = "force-dynamic";

export default async function LaravelSecurityIssuesPage() {
  const { ls, can } = await getLsAccess();
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;

  const db = await getDb();
  const projects = await db.query`SELECT Id, Name FROM LaravelSecurityProjects WHERE DeletedAt IS NULL ORDER BY Name`;

  return (
    <Suspense fallback={null}>
      <IssuesListClient can={can} projects={projects.recordset} />
    </Suspense>
  );
}
