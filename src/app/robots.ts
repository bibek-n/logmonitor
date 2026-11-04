import type { MetadataRoute } from "next";

// This is an internal IT admin tool, not a public product - nothing on it (including the
// marketing/support pages, which are otherwise unauthenticated and so would be crawlable)
// should ever be indexed. Paired with the root layout's `robots: {index:false}` meta tag
// (src/app/layout.tsx) as a second signal, since a crawler that ignores one usually still
// honors the other.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
