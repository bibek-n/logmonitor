# Website Speed & Performance

Real-browser page speed monitoring for websites already registered under **Audit > Websites**
(the same list used by SSL Checker, Header Viewer, GA Tag Finder, and Website Security Audit).
No separate website registry - every performance table references the existing `Websites`
table via `WebsiteId`.

## Architecture

This app has no headless browser (Puppeteer/Playwright/Lighthouse) installed anywhere, and
adding one would mean bundling a Chromium binary plus CPU/memory isolation onto the
Windows/IIS host that runs LogMonitor - there's no existing precedent for that. Instead this
module calls **Google PageSpeed Insights API v5**, which runs real Lighthouse in Google's cloud
and returns genuine Core Web Vitals, a Lighthouse performance score, and the full optimization
audit catalog.

**`PAGESPEED_API_KEY` is required, not optional.** Verified live: the unauthenticated/no-key
tier returned `429 Quota exceeded for quota metric 'Queries' and limit 'Queries per day'`
immediately (this project's shared anonymous quota was already exhausted). Get a free key at
https://developers.google.com/speed/docs/insights/v5/get-started (enable the "PageSpeed
Insights API" on a Google Cloud project - free tier is 25,000 requests/day) and set
`PAGESPEED_API_KEY` in the server's `.env`. Every "Run Test" action will fail with a 429 until
this is set.

Connection-level timing (DNS/TCP/TLS/TTFB/redirects/server IP/status code) is measured
separately and directly by this app (`src/lib/websitePerformance/connectionTiming.ts`), since
PSI doesn't expose that phase breakdown - this reuses the same private-IP/SSRF-blocking range
logic already established in `src/lib/trafficByCountry.ts`.

## Key files

- `scripts/migrate-website-performance.ts` - schema (`WebsitePerformanceConfigs`,
  `WebsitePerformanceScans`, `WebsitePerformanceResourceMetrics`, `WebsiteOptimizationChecks`,
  `WebsitePerformanceAlerts`, `WebsitePerformanceReports`), all FK'd to `Websites`.
- `src/lib/websitePerformance/pagespeed.ts` - PSI API client, maps Lighthouse's response into
  this app's shape.
- `src/lib/websitePerformance/connectionTiming.ts` - DNS/TCP/TLS/TTFB phase timing + SSRF guard.
- `src/lib/websitePerformance/scoring.ts` - derives the four sub-scores PSI doesn't hand back
  directly (Core Web Vitals / Server Response / Resource Optimization / User Experience).
  Weight/threshold tuning is env-var driven (`WPERF_*`) rather than a new settings UI. The
  headline Overall/Mobile/Desktop score is Lighthouse's own `categories.performance` score,
  not re-derived.
- `src/lib/websitePerformance/runTest.ts` - the worker: validates the website, prevents
  duplicate concurrent tests per website+device, runs PSI + connection timing, stores results,
  evaluates alert thresholds, emails via the existing `notifyEmail.ts` (no second notification
  system), auto-resolves alerts that stop breaching.
- `src/app/api/admin/website-performance/**` - REST API (config, run, bulk-run, bulk-config,
  latest, history, compare, dashboard, export, screenshot), all `requireAdmin`-gated matching
  the Website Security Audit module's convention.
- `src/app/dashboard/audit/website-performance/**` - selection page (filters, bulk actions,
  dashboard summary + charts) and per-website detail page (Overview / Timing Breakdown / Core
  Web Vitals / Resource Analysis / Optimization Checks / Comparison / History / Settings tabs).
- `scripts/run-website-performance-scheduled-scan.ts` + matching `.ps1` - interval-based
  scheduler (due-ness computed from time-since-last-completed-scan, not a stored `LastRunAt`),
  meant to be invoked every 5-15 minutes by a Windows Scheduled Task, same pattern as
  `run-website-security-daily-scan.ps1`.

## Deliberate simplifications vs. the original spec

- **Environment/Owner/Group/Tag** filters aren't offered - the underlying `Websites` table
  only ever has `Name`/`Url`/`Enabled`, so faking those filters against nonexistent data would
  be worse than omitting them.
- **Test location, browser type, network throttling profile, and number of test runs** aren't
  independently configurable - PSI runs a single fixed simulation per strategy (mobile/desktop)
  from Google's own infrastructure; exposing knobs that don't actually change anything would be
  dishonest UI.
- **SSL status** isn't persisted or duplicated here - the existing SSL Checker tool is
  on-demand/stateless with no stored table to read from, so the detail page links out to it
  instead of re-implementing TLS checking.
- **`website_performance_comparisons`** isn't a stored table - comparisons are computed live
  from the two scans being compared, which is cheap and avoids write amplification.
- **PDF report generation** (pdfkit, matching the Website Security Audit's report style) is not
  yet built - CSV export (`GET /api/admin/website-performance/{id}/export`) and the JSON API
  responses themselves cover the "raw data export" requirement for now.
- **Windows Task Scheduler registration** for the new scheduled-scan script is not done as part
  of this change - the script and `.ps1` wrapper exist and are ready to register.

## Environment variables

- `PAGESPEED_API_KEY` (optional) - raises PSI's rate limit above the unauthenticated default.
- `WEBSITE_PERFORMANCE_ALERT_RECIPIENTS` (optional) - defaults to the same admin distribution
  list used by Website Security Audit's report emails.
- `WPERF_*` (optional) - sub-score thresholds/weights, see `scoring.ts` for the full list and
  defaults.
