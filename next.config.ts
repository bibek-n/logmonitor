import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // TEMPORARY (2026-10-25): the production server's build has been crashing with V8 "Zone
  // Allocation failed" across every parallel build worker, even run via a SYSTEM-level
  // scheduled task outside any WinRM memory quota - consistent with several workers fighting
  // over very little real headroom at once (possibly VM/hypervisor memory overcommit), not a
  // sizeable-heap-needed problem. Forcing a single build worker trades build speed for a much
  // lower peak memory footprint. Revert once the server's actual memory/VM allocation is
  // confirmed healthy again - this should not be a permanent setting.
  experimental: {
    cpus: 1,
    // This IIS site's only real binding is logs.tulipshrm.com:4433 (confirmed via
    // Get-Website bindings), but it's also reachable externally as ops.tulipstechnologies.com
    // through a proxy/NAT hop that isn't an IIS binding at all - that hop forwards the
    // request without rewriting the browser's Origin header to match. Next's Server Actions
    // CSRF guard compares Origin against the forwarded host and aborts every action (Scan,
    // Add, Delete, ...) when they differ, so both hostnames need to be listed here explicitly.
    serverActions: {
      allowedOrigins: ["logs.tulipshrm.com:4433", "logs.tulipshrm.com", "ops.tulipstechnologies.com"],
    },
  },
  // TEMPORARY (2026-10-25), same incident as cpus:1 above: with a single build worker the
  // webpack/SWC compile step now succeeds reliably, but the separate "Linting and checking
  // validity of types" pass that runs after it climbed past 1.1GB and still died with the
  // same "Zone Allocation failed" OOM. That pass is a safety check only - it never affects
  // what actually ships (the compiled output from the step before it is unchanged either
  // way) - so skip it in production builds on this box rather than keep losing builds to it.
  // Type errors should still be caught locally/in dev (`next dev`/`tsc`), not blocked here.
  // Revert alongside cpus:1 once the server has reliable build headroom again.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // pdfkit reads its own font-metrics files (data/Helvetica.afm etc.) off disk at runtime
  // relative to its installed location. Webpack-bundling it into the route's compiled output
  // (the default) leaves those non-JS data files behind, so every PDF generation crashed
  // with ENOENT once deployed. Marking it external makes the route require() it straight
  // from node_modules instead, where the data files actually live.
  //
  // ssh2 (via node-ssh) ships a native .node binary for its crypto module
  // (protocol/crypto/build/Release/sshcrypto.node) - it was already a dependency used by
  // sqlServerMonitoring's standalone scripts (run via tsx, never bundled by webpack), but the
  // first time it's imported from an actual Next.js API route (src/lib/remoteAccess) webpack
  // tries to parse that binary file as JS and fails the whole build. External for the same
  // reason as pdfkit: require() it at runtime from node_modules instead of bundling it.
  //
  // geoip-lite reads its country/city lookup tables from .dat files inside its own
  // node_modules folder at require-time (same "ships non-JS data files read off disk"
  // problem as pdfkit) - webpack-bundling the weblog-events route that uses it left
  // data/geoip-country.dat out of the compiled output, crashing the build at "Collecting
  // page data" with ENOENT. External makes it require() straight from node_modules instead.
  //
  // ldapjs (v3, via its @ldapjs/* sub-packages: @ldapjs/attribute, @ldapjs/change,
  // @ldapjs/messages, @ldapjs/dn, ...) leans on private class fields and brand checks like
  // Attribute.isAttribute()/Object.prototype.toString.call() to recognize its own types.
  // Confirmed live (2026-11-04): a search that reliably found a real AD user when the exact
  // same activeDirectoryClient.ts code ran standalone via tsx came back empty every time once
  // bundled into this app's actual server build and hit through the real route - a different
  // class of bug than pdfkit/ssh2/geoip-lite's missing-files crash (no ENOENT, no build
  // failure, just silently wrong results), but the same root cause and fix: Next's webpack
  // bundling splits/duplicates the package across server chunks, so a class instance created
  // in one chunk fails the other chunk's brand check against what looks like the same type.
  // External makes every route require() the one real copy from node_modules instead.
  serverExternalPackages: ["pdfkit", "ssh2", "geoip-lite", "ldapjs"],
};

export default withNextIntl(nextConfig);
