import { redirect } from "next/navigation";

// A bare deep-link redirect - the actual Issue Details view is the drawer on the Issues list
// (see IssuesListClient's `openIssue` query param handling), matching Code Quality's own
// issues/:id redirect route. This route exists so `/dashboard/laravel-security/issues/:id`
// links (from Scan Details, notifications, etc.) resolve to something rather than 404ing.
export default async function LaravelSecurityIssueRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/laravel-security/issues?openIssue=${encodeURIComponent(id)}`);
}
