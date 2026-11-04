import { redirect } from "next/navigation";

// The marketing homepage (hero slider, news widgets, services, etc.) is retired as the site
// root per request - / now goes straight to the sign-in screen instead. The rest of the
// public marketing site (Support, Contact, About, etc.) is untouched and still reachable by
// direct link, including from the login page's own "Help Center"/"Contact Support" links.
export default function HomePage() {
  redirect("/login");
}
