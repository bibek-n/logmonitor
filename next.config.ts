import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // pdfkit reads its own font-metrics files (data/Helvetica.afm etc.) off disk at runtime
  // relative to its installed location. Webpack-bundling it into the route's compiled output
  // (the default) leaves those non-JS data files behind, so every PDF generation crashed
  // with ENOENT once deployed. Marking it external makes the route require() it straight
  // from node_modules instead, where the data files actually live.
  serverExternalPackages: ["pdfkit"],
};

export default withNextIntl(nextConfig);
