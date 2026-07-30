import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { getBrowserActivitySettings } from "@/lib/browserActivity/repository";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const sectionStyle: React.CSSProperties = { marginBottom: "1rem" };
const headingStyle: React.CSSProperties = { fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)", marginBottom: "0.35rem" };
const bodyStyle: React.CSSProperties = { fontSize: "0.85rem", color: "var(--ink-secondary)", lineHeight: 1.6 };

export default async function BrowserActivityPolicyPage() {
  const ba = await getBrowserActivitySession("ba_view");
  if (!ba) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Monitoring Policy</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this policy.</p>
      </div>
    );
  }

  const settings = await getBrowserActivitySettings();

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Browser Activity Monitoring Policy</h1>
      <Card>
        <div style={sectionStyle}>
          <p style={bodyStyle}>
            This company monitors work-related web browsing on <strong>company-owned, company-managed devices only</strong> -
            never on personal or unmanaged devices.
          </p>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}>What is collected</div>
          <p style={bodyStyle}>
            Domain visited (not the full page address), page title (except for excluded domains), date/time, an estimated
            time spent on the domain, browser used, device, the associated employee, and any known phishing/malware/
            blocked-domain hits.
          </p>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}>What is never collected</div>
          <p style={bodyStyle}>
            Passwords, form contents, keystrokes, cookies or session tokens, payment details, personal message content,
            full page content, or private/incognito browsing content. Full URLs, query strings, and search terms are never
            transmitted from the device - only the bare domain.
          </p>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}>Why</div>
          <p style={bodyStyle}>Security posture and acceptable-use compliance - this is not intended to police personal time or productivity.</p>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}>Who can access it</div>
          <p style={bodyStyle}>
            Access is role-restricted (e.g. Security Administrator, HR Reviewer, Read-only Auditor). Every view, search, and
            export of this data is itself logged to the audit trail.
          </p>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}>Sensitive domains</div>
          <p style={bodyStyle}>
            Domains in categories such as medical, banking, legal, and union are excluded from collection by policy,
            regardless of device - see the Excluded Domains page for the current list.
          </p>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}>Retention</div>
          <p style={bodyStyle}>
            Collected data is retained for <strong>{settings.retentionDays} days</strong>, then automatically and permanently
            deleted. This figure reflects the currently configured retention period and updates here whenever it changes.
          </p>
        </div>

        <div>
          <div style={headingStyle}>Consent</div>
          <p style={bodyStyle}>
            Monitoring begins only after attended, on-screen consent is given at device enrollment - the employee is shown
            what will be collected before the agent is installed.
          </p>
        </div>
      </Card>
    </div>
  );
}
