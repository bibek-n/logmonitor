import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
  serverExternalPackages: ["pdfkit", "ssh2"],
};

export default withNextIntl(nextConfig);
