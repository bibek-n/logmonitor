import { redirect } from "next/navigation";

// A bare deep-link redirect - the actual Issue Details view is the drawer on the Issues list
// (see IssuesListClient's `openIssue` query param handling), matching the spec's own
// allowance of "an existing Admin Panel page, modal, or side drawer." This route exists so
// `/dashboard/code-quality/issues/:id` links (from Scan Details, notifications, etc.) resolve
// to something rather than 404ing.
export default async function CodeQualityIssueRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/code-quality/issues?openIssue=${encodeURIComponent(id)}`);
}
