import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Registers webdev.tulipshrm.com as a WAF Gateway application in Monitoring mode (evaluates and
// logs, never blocks - see waf-gateway-server.ts) and seeds a small starter set of Global rules,
// same "ship something useful on day one, not an empty table" precedent as Intrusion
// Detection's starterRules.ts. Idempotent: skips anything that already exists by name/domain.

const APP = {
  name: "TulipsHRM Webdev",
  description: "webdev.tulipshrm.com, served by IIS (TulipsHrm_Webdev site) on this same box - the WAF Gateway proxy reaches it over the loopback interface.",
  publicDomain: "webdev.tulipshrm.com",
  originServer: "127.0.0.1",
  originPort: 4433,
  httpsEnabled: true,
  wafMode: "Monitoring",
};

// A deliberately small, well-understood starting set - common attack patterns an admin can
// extend from, not a claim of comprehensive OWASP coverage. Target/pattern conventions match
// proxyEngine.ts's patternMatches (a bare string = substring match, /.../  = regex).
const STARTER_RULES: {
  ruleName: string;
  description: string;
  category: string;
  severity: "Informational" | "Low" | "Medium" | "High" | "Critical";
  pattern: string;
  target: "Url" | "QueryString" | "Headers" | "Cookies" | "Body" | "UserAgent" | "IpAddress" | "HttpMethod";
  action: "Allow" | "Block" | "Log" | "Challenge" | "RateLimit";
}[] = [
  {
    ruleName: "SQL injection - UNION/boolean patterns",
    description: "Classic SQL injection probes in the query string (UNION SELECT, OR 1=1, stacked queries, SQL comments).",
    category: "sql_injection",
    severity: "High",
    pattern: "/(\\bunion\\b[^\\n]*\\bselect\\b|\\bor\\b\\s+['\"]?\\d+['\"]?\\s*=\\s*['\"]?\\d+['\"]?|;\\s*(drop|delete|update)\\s|--\\s|\\/\\*.*\\*\\/)/i",
    target: "QueryString",
    action: "Log",
  },
  {
    ruleName: "Cross-site scripting - script/event handler injection",
    description: "Common XSS payload shapes (<script>, javascript:, onerror=/onload= handlers) in the query string.",
    category: "xss",
    severity: "High",
    pattern: "/(<script[\\s>]|javascript:|on(error|load|mouseover|click)\\s*=)/i",
    target: "QueryString",
    action: "Log",
  },
  {
    ruleName: "Path traversal",
    description: "Directory traversal attempts in the request path.",
    category: "path_traversal",
    severity: "High",
    pattern: "/(\\.\\.\\/|\\.\\.\\\\|%2e%2e%2f|%2e%2e\\/)/i",
    target: "Url",
    action: "Log",
  },
  {
    ruleName: "Sensitive file access",
    description: "Requests for files that should never be publicly served (.env, .git, backups, common config files).",
    category: "sensitive_file_access",
    severity: "High",
    pattern: "/\\.(env|git\\/config|sql|bak|old)(\\?|$)/i",
    target: "Url",
    action: "Log",
  },
  {
    ruleName: "Known vulnerability scanner user agents",
    description: "User-Agent strings identifying common automated scanning tools.",
    category: "recon",
    severity: "Medium",
    pattern: "/(sqlmap|nikto|nessus|acunetix|nmap|masscan|zgrab)/i",
    target: "UserAgent",
    action: "Log",
  },
  {
    ruleName: "Command injection shell metacharacters",
    description: "Shell metacharacter sequences commonly used to chain OS commands into an injected parameter.",
    category: "command_injection",
    severity: "Critical",
    pattern: "/(;|\\|\\||&&)\\s*(cat|whoami|wget|curl|nc|bash|sh)\\b/i",
    target: "QueryString",
    action: "Log",
  },
];

async function main() {
  const db = await getDb();

  const existingApp = await db.request().input("d", sql.NVarChar, APP.publicDomain).query<{ Id: number }>("SELECT Id FROM WafApplications WHERE PublicDomain = @d");
  let appId: number;
  if (existingApp.recordset[0]) {
    appId = existingApp.recordset[0].Id;
    console.log(`Application already registered: ${APP.publicDomain} (Id ${appId}) - leaving it as-is.`);
  } else {
    const inserted = await db
      .request()
      .input("name", sql.NVarChar, APP.name)
      .input("description", sql.NVarChar, APP.description)
      .input("publicDomain", sql.NVarChar, APP.publicDomain)
      .input("originServer", sql.NVarChar, APP.originServer)
      .input("originPort", sql.Int, APP.originPort)
      .input("httpsEnabled", sql.Bit, APP.httpsEnabled)
      .input("wafMode", sql.NVarChar, APP.wafMode)
      .query<{ Id: number }>(
        `INSERT INTO WafApplications (Name, Description, PublicDomain, OriginServer, OriginPort, HttpsEnabled, WafMode)
         OUTPUT INSERTED.Id VALUES (@name, @description, @publicDomain, @originServer, @originPort, @httpsEnabled, @wafMode)`
      );
    appId = inserted.recordset[0].Id;
    console.log(`Registered ${APP.publicDomain} as WafApplications.Id ${appId} (WafMode=${APP.wafMode}).`);
  }

  let created = 0;
  for (const rule of STARTER_RULES) {
    const exists = await db.request().input("n", sql.NVarChar, rule.ruleName).query("SELECT 1 FROM WafRules WHERE RuleName = @n");
    if (exists.recordset.length > 0) continue;
    await db
      .request()
      .input("ruleName", sql.NVarChar, rule.ruleName)
      .input("description", sql.NVarChar, rule.description)
      .input("category", sql.NVarChar, rule.category)
      .input("severity", sql.NVarChar, rule.severity)
      .input("pattern", sql.NVarChar, rule.pattern)
      .input("target", sql.NVarChar, rule.target)
      .input("action", sql.NVarChar, rule.action)
      .query(
        `INSERT INTO WafRules (RuleName, Description, Category, Severity, Pattern, Target, Action, Enabled, Mode)
         VALUES (@ruleName, @description, @category, @severity, @pattern, @target, @action, 1, 'Global')`
      );
    created++;
  }
  console.log(`Starter rules: ${created} created, ${STARTER_RULES.length - created} already existed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
