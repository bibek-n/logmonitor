// Next.js's client runtime sets a `window.next = { version, appDir, router }` global on every
// page - used internally for the dev/RSC error overlay, but present in production builds too.
// This is the exact signal third-party "built with" scanners (e.g. Wappalyzer's own Next.js
// fingerprint, `js: { "next.version": ... }`) read to report a Next.js version; verified
// against a real site where `window.next.version` matched what such a scanner reported.
//
// Nothing else in platformDetect.ts can see this - the raw HTML/headers never carry a version
// for Next.js the way WordPress's <meta generator> tag does, and (unlike the X-Powered-By
// header Wappalyzer also checks) most deployments don't append a version to that header either.
// Reading `window.next.version` requires the page's JS to actually run, so this needs a real
// browser rather than the plain fetch() the rest of this module's scans use.
//
// Deliberately kept out of platformDetect.ts and dynamic-imported here rather than imported at
// module scope: platformDetect.ts is imported by WebsitesListClient.tsx, a "use client"
// component, and a Node-only browser-automation package must never end up in that client bundle.
//
// Playwright is already a project devDependency (used for `npm run test:e2e`); this is the
// first place it's launched at request time, so Chromium needs to be installed on the app
// server (`npx playwright install chromium`) for this to actually find anything there.

const NEXTJS_VERSION_BROWSER_TIMEOUT_MS = 20000;
const NEXTJS_VERSION_PATTERN = /^\d+(\.\d+){1,3}(-[\w.]+)?$/;

export async function detectNextJsVersionViaBrowser(url: string): Promise<string | null> {
  let browser: import("@playwright/test").Browser | undefined;
  try {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NEXTJS_VERSION_BROWSER_TIMEOUT_MS });
    // window.next is set synchronously very early, but give it a brief grace window on slower
    // pages before giving up rather than racing the single domcontentloaded check.
    await page
      .waitForFunction(() => typeof (window as unknown as { next?: { version?: string } }).next?.version === "string", {
        timeout: 5000,
      })
      .catch(() => {});
    const version = await page.evaluate(() => (window as unknown as { next?: { version?: string } }).next?.version ?? null);
    return typeof version === "string" && NEXTJS_VERSION_PATTERN.test(version) ? version : null;
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
