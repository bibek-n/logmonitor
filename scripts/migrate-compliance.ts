import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// A curated, representative set of controls per framework - not the full official control
// catalog (ISO 27001 Annex A alone has 93 controls, PCI DSS has hundreds of sub-requirements,
// NIST CSF 2.0 has 108 subcategories). This tracks the controls this app can meaningfully help
// with: either a manually-assessed status/evidence/notes record, or (where AutoCheckKey is set)
// a signal derived from data this app already collects elsewhere (malware scans, SSL certs,
// intrusion detection, audit log, backups, MFA enrollment, vulnerability scans, patch status,
// device inventory - see src/lib/compliance/autoChecks.ts). This is a compliance TRACKING tool,
// not a certified audit/attestation product - the UI must say so plainly.
interface SeedControl {
  frameworkKey: string;
  controlCode: string;
  category: string;
  title: string;
  description: string;
  autoCheckKey: string | null;
  sortOrder: number;
}

const FRAMEWORKS = [
  { key: "iso27001", name: "ISO 27001", description: "Information security management system (ISMS) standard - controls below are drawn from Annex A." },
  { key: "pcidss", name: "PCI DSS", description: "Payment Card Industry Data Security Standard - controls below map to its 12 top-level requirements." },
  { key: "hipaa", name: "HIPAA", description: "Health Insurance Portability and Accountability Act Security Rule - Administrative, Physical, and Technical safeguards." },
  { key: "nist", name: "NIST CSF", description: "NIST Cybersecurity Framework 2.0 - Govern, Identify, Protect, Detect, Respond, Recover functions." },
  { key: "soc2", name: "SOC 2", description: "SOC 2 Trust Services Criteria - Security (Common Criteria) and Availability." },
];

const CONTROLS: SeedControl[] = [
  // --- ISO 27001 (Annex A, curated) ---
  { frameworkKey: "iso27001", controlCode: "A.5.1", category: "Policies", title: "Information security policies", description: "Management direction and support for information security across the organization.", autoCheckKey: null, sortOrder: 1 },
  { frameworkKey: "iso27001", controlCode: "A.5.15", category: "Access Control", title: "Access control", description: "Rules to control physical and logical access to information and systems, based on business requirements.", autoCheckKey: "mfa_enabled", sortOrder: 2 },
  { frameworkKey: "iso27001", controlCode: "A.5.23", category: "Cloud Security", title: "Information security for use of cloud services", description: "Processes for acquisition, use, and exit from cloud services in line with security requirements.", autoCheckKey: null, sortOrder: 3 },
  { frameworkKey: "iso27001", controlCode: "A.5.30", category: "Business Continuity", title: "ICT readiness for business continuity", description: "ICT readiness planned, implemented, and tested based on business continuity objectives.", autoCheckKey: "backup_status", sortOrder: 4 },
  { frameworkKey: "iso27001", controlCode: "A.5.35", category: "Review", title: "Independent review of information security", description: "The organization's approach to security is reviewed independently at planned intervals.", autoCheckKey: null, sortOrder: 5 },
  { frameworkKey: "iso27001", controlCode: "A.5.36", category: "Compliance", title: "Compliance with policies, rules and standards", description: "Compliance with the organization's own security policy, topic-specific policies, and standards.", autoCheckKey: null, sortOrder: 6 },
  { frameworkKey: "iso27001", controlCode: "A.8.7", category: "Malware", title: "Protection against malware", description: "Protection against malware implemented and supported by user awareness.", autoCheckKey: "malware_scanning", sortOrder: 7 },
  { frameworkKey: "iso27001", controlCode: "A.8.8", category: "Vulnerability Management", title: "Management of technical vulnerabilities", description: "Information on technical vulnerabilities obtained, exposure evaluated, and appropriate action taken.", autoCheckKey: "vulnerability_scanning", sortOrder: 8 },
  { frameworkKey: "iso27001", controlCode: "A.8.9", category: "Configuration", title: "Configuration management", description: "Configurations (including security configurations) established, documented, and monitored.", autoCheckKey: null, sortOrder: 9 },
  { frameworkKey: "iso27001", controlCode: "A.8.12", category: "Data Protection", title: "Data leakage prevention", description: "Measures applied to systems, networks, and devices that process, store, or transmit sensitive data.", autoCheckKey: null, sortOrder: 10 },
  { frameworkKey: "iso27001", controlCode: "A.8.13", category: "Backup", title: "Information backup", description: "Backup copies of information, software, and systems maintained and tested regularly.", autoCheckKey: "backup_status", sortOrder: 11 },
  { frameworkKey: "iso27001", controlCode: "A.8.16", category: "Monitoring", title: "Monitoring activities", description: "Networks, systems, and applications monitored for anomalous behaviour.", autoCheckKey: "intrusion_monitoring", sortOrder: 12 },
  { frameworkKey: "iso27001", controlCode: "A.8.20", category: "Network Security", title: "Networks security", description: "Networks and network devices secured, managed, and controlled to protect information in systems and applications.", autoCheckKey: null, sortOrder: 13 },
  { frameworkKey: "iso27001", controlCode: "A.8.24", category: "Cryptography", title: "Use of cryptography", description: "Rules for effective use of cryptography, including encryption of data in transit and at rest.", autoCheckKey: "ssl_certificates", sortOrder: 14 },

  // --- PCI DSS (12 requirements) ---
  { frameworkKey: "pcidss", controlCode: "Req-1", category: "Network Security", title: "Install and maintain network security controls", description: "Firewalls and network segmentation protect cardholder data environments.", autoCheckKey: "intrusion_monitoring", sortOrder: 1 },
  { frameworkKey: "pcidss", controlCode: "Req-2", category: "Configuration", title: "Apply secure configurations to all system components", description: "Vendor defaults removed, systems hardened before deployment.", autoCheckKey: null, sortOrder: 2 },
  { frameworkKey: "pcidss", controlCode: "Req-3", category: "Data Protection", title: "Protect stored account data", description: "Cardholder data encrypted, truncated, or otherwise rendered unreadable where stored.", autoCheckKey: null, sortOrder: 3 },
  { frameworkKey: "pcidss", controlCode: "Req-4", category: "Cryptography", title: "Protect cardholder data with strong cryptography during transmission", description: "Strong cryptography (TLS) used for cardholder data sent over open, public networks.", autoCheckKey: "ssl_certificates", sortOrder: 4 },
  { frameworkKey: "pcidss", controlCode: "Req-5", category: "Malware", title: "Protect all systems and networks from malicious software", description: "Anti-malware solutions deployed, kept current, and actively scanning.", autoCheckKey: "malware_scanning", sortOrder: 5 },
  { frameworkKey: "pcidss", controlCode: "Req-6", category: "Secure Development", title: "Develop and maintain secure systems and software", description: "Secure development practices and timely patching of known vulnerabilities.", autoCheckKey: "patch_management", sortOrder: 6 },
  { frameworkKey: "pcidss", controlCode: "Req-7", category: "Access Control", title: "Restrict access to system components by business need to know", description: "Access to system components and cardholder data limited to only those with a job-related need.", autoCheckKey: null, sortOrder: 7 },
  { frameworkKey: "pcidss", controlCode: "Req-8", category: "Authentication", title: "Identify users and authenticate access to system components", description: "Unique IDs and multi-factor authentication for all access to the cardholder data environment.", autoCheckKey: "mfa_enabled", sortOrder: 8 },
  { frameworkKey: "pcidss", controlCode: "Req-9", category: "Physical Security", title: "Restrict physical access to cardholder data", description: "Physical access to systems and media containing cardholder data appropriately restricted.", autoCheckKey: null, sortOrder: 9 },
  { frameworkKey: "pcidss", controlCode: "Req-10", category: "Logging", title: "Log and monitor all access to system components and cardholder data", description: "Audit trails link all access to individual users and are reviewed regularly.", autoCheckKey: "audit_logging", sortOrder: 10 },
  { frameworkKey: "pcidss", controlCode: "Req-11", category: "Testing", title: "Test security of systems and networks regularly", description: "Regular vulnerability scans and penetration testing of the cardholder data environment.", autoCheckKey: "vulnerability_scanning", sortOrder: 11 },
  { frameworkKey: "pcidss", controlCode: "Req-12", category: "Policy", title: "Support information security with organizational policies and programs", description: "A formal security policy and awareness program maintained for all personnel.", autoCheckKey: null, sortOrder: 12 },

  // --- HIPAA Security Rule (curated) ---
  { frameworkKey: "hipaa", controlCode: "164.308(a)(1)", category: "Administrative", title: "Security management process", description: "Risk analysis and risk management to reduce risks/vulnerabilities to ePHI.", autoCheckKey: "vulnerability_scanning", sortOrder: 1 },
  { frameworkKey: "hipaa", controlCode: "164.308(a)(3)", category: "Administrative", title: "Workforce security", description: "Procedures for authorization/supervision of workforce members who work with ePHI.", autoCheckKey: null, sortOrder: 2 },
  { frameworkKey: "hipaa", controlCode: "164.308(a)(4)", category: "Administrative", title: "Information access management", description: "Role-based procedures for authorizing access to ePHI.", autoCheckKey: null, sortOrder: 3 },
  { frameworkKey: "hipaa", controlCode: "164.308(a)(5)", category: "Administrative", title: "Security awareness and training", description: "Ongoing security awareness and training program for all workforce members.", autoCheckKey: null, sortOrder: 4 },
  { frameworkKey: "hipaa", controlCode: "164.308(a)(7)", category: "Administrative", title: "Contingency plan", description: "Data backup, disaster recovery, and emergency mode operation plans for systems with ePHI.", autoCheckKey: "backup_status", sortOrder: 5 },
  { frameworkKey: "hipaa", controlCode: "164.308(a)(8)", category: "Administrative", title: "Evaluation", description: "Periodic technical and non-technical evaluation of security safeguards.", autoCheckKey: null, sortOrder: 6 },
  { frameworkKey: "hipaa", controlCode: "164.310(a)(1)", category: "Physical", title: "Facility access controls", description: "Limit physical access to facilities housing systems that hold ePHI.", autoCheckKey: null, sortOrder: 7 },
  { frameworkKey: "hipaa", controlCode: "164.310(c)", category: "Physical", title: "Workstation security", description: "Physical safeguards for workstations that access ePHI, restricting access to authorized users.", autoCheckKey: null, sortOrder: 8 },
  { frameworkKey: "hipaa", controlCode: "164.310(d)(1)", category: "Physical", title: "Device and media controls", description: "Policies for disposal, reuse, and movement of hardware/media containing ePHI.", autoCheckKey: null, sortOrder: 9 },
  { frameworkKey: "hipaa", controlCode: "164.312(a)(1)", category: "Technical", title: "Access control", description: "Unique user identification, automatic logoff, and encryption to control access to ePHI.", autoCheckKey: "mfa_enabled", sortOrder: 10 },
  { frameworkKey: "hipaa", controlCode: "164.312(b)", category: "Technical", title: "Audit controls", description: "Hardware/software/procedural mechanisms to record and examine activity in systems with ePHI.", autoCheckKey: "audit_logging", sortOrder: 11 },
  { frameworkKey: "hipaa", controlCode: "164.312(e)(1)", category: "Technical", title: "Transmission security", description: "Technical measures to guard against unauthorized access to ePHI transmitted over networks.", autoCheckKey: "ssl_certificates", sortOrder: 12 },

  // --- NIST CSF 2.0 (curated, one to two per function) ---
  { frameworkKey: "nist", controlCode: "GV.OC", category: "Govern", title: "Organizational context", description: "The organization's mission, stakeholders, and cybersecurity risk are understood.", autoCheckKey: null, sortOrder: 1 },
  { frameworkKey: "nist", controlCode: "GV.PO", category: "Govern", title: "Policy", description: "Organizational cybersecurity policy is established, communicated, and enforced.", autoCheckKey: null, sortOrder: 2 },
  { frameworkKey: "nist", controlCode: "GV.RM", category: "Govern", title: "Risk management strategy", description: "The organization's priorities, constraints, and risk tolerance are established and communicated.", autoCheckKey: null, sortOrder: 3 },
  { frameworkKey: "nist", controlCode: "ID.AM", category: "Identify", title: "Asset management", description: "Assets (devices, systems) are identified and managed consistent with their risk to the organization.", autoCheckKey: "device_inventory", sortOrder: 4 },
  { frameworkKey: "nist", controlCode: "ID.RA", category: "Identify", title: "Risk assessment", description: "Cybersecurity risk to the organization, assets, and individuals is understood.", autoCheckKey: "vulnerability_scanning", sortOrder: 5 },
  { frameworkKey: "nist", controlCode: "PR.AA", category: "Protect", title: "Identity management, authentication and access control", description: "Access to physical and logical assets is limited to authorized users, services, and devices.", autoCheckKey: "mfa_enabled", sortOrder: 6 },
  { frameworkKey: "nist", controlCode: "PR.DS", category: "Protect", title: "Data security", description: "Data is managed consistent with the organization's risk strategy, including encryption in transit.", autoCheckKey: "ssl_certificates", sortOrder: 7 },
  { frameworkKey: "nist", controlCode: "PR.PS", category: "Protect", title: "Platform security", description: "Hardware, software, and firmware are managed consistent with the risk strategy, including patching.", autoCheckKey: "patch_management", sortOrder: 8 },
  { frameworkKey: "nist", controlCode: "DE.CM", category: "Detect", title: "Continuous monitoring", description: "Assets are monitored to find anomalies, indicators of compromise, and other events.", autoCheckKey: "intrusion_monitoring", sortOrder: 9 },
  { frameworkKey: "nist", controlCode: "DE.AE", category: "Detect", title: "Adverse event analysis", description: "Anomalies and indicators of compromise are analyzed to characterize events and detect incidents.", autoCheckKey: "audit_logging", sortOrder: 10 },
  { frameworkKey: "nist", controlCode: "RS.MA", category: "Respond", title: "Incident management", description: "Responses to detected incidents are managed according to organizational procedures.", autoCheckKey: null, sortOrder: 11 },
  { frameworkKey: "nist", controlCode: "RC.RP", category: "Recover", title: "Recovery planning", description: "Restoration activities are performed to ensure operational availability of systems affected by incidents.", autoCheckKey: "backup_status", sortOrder: 12 },
  { frameworkKey: "nist", controlCode: "RC.CO", category: "Recover", title: "Recovery communication", description: "Restoration activities are communicated to stakeholders and executive/management teams.", autoCheckKey: null, sortOrder: 13 },

  // --- SOC 2 (Trust Services Criteria, curated) ---
  { frameworkKey: "soc2", controlCode: "CC1", category: "Control Environment", title: "Commitment to integrity and ethical values", description: "The entity demonstrates commitment to integrity and ethical values, setting the tone for internal control.", autoCheckKey: null, sortOrder: 1 },
  { frameworkKey: "soc2", controlCode: "CC2", category: "Communication", title: "Communication and information", description: "Internal and external communication of objectives and responsibilities for internal control.", autoCheckKey: null, sortOrder: 2 },
  { frameworkKey: "soc2", controlCode: "CC3", category: "Risk Assessment", title: "Risk assessment", description: "The entity specifies objectives and identifies/analyzes risk to those objectives.", autoCheckKey: "vulnerability_scanning", sortOrder: 3 },
  { frameworkKey: "soc2", controlCode: "CC4", category: "Monitoring Activities", title: "Ongoing and separate evaluations", description: "The entity evaluates and communicates internal control deficiencies in a timely manner.", autoCheckKey: "audit_logging", sortOrder: 4 },
  { frameworkKey: "soc2", controlCode: "CC5", category: "Control Activities", title: "Control activities", description: "The entity selects and develops control activities that mitigate risk to acceptable levels.", autoCheckKey: null, sortOrder: 5 },
  { frameworkKey: "soc2", controlCode: "CC6.1", category: "Logical Access", title: "Logical access security", description: "Logical access security software, infrastructure, and architectures restrict access to authorized users.", autoCheckKey: "mfa_enabled", sortOrder: 6 },
  { frameworkKey: "soc2", controlCode: "CC6.6", category: "Boundary Protection", title: "Logical and physical boundary protections", description: "The entity implements logical and physical boundary protections against threats from outside its boundaries.", autoCheckKey: "intrusion_monitoring", sortOrder: 7 },
  { frameworkKey: "soc2", controlCode: "CC6.7", category: "Data Transmission", title: "Restricts transmission and movement of data", description: "The entity restricts transmission, movement, and removal of information, using encryption where appropriate.", autoCheckKey: "ssl_certificates", sortOrder: 8 },
  { frameworkKey: "soc2", controlCode: "CC6.8", category: "Malware Prevention", title: "Prevents/detects unauthorized or malicious software", description: "The entity implements controls to prevent or detect the introduction of unauthorized/malicious software.", autoCheckKey: "malware_scanning", sortOrder: 9 },
  { frameworkKey: "soc2", controlCode: "CC7.1", category: "Vulnerability Detection", title: "Detects and monitors for vulnerabilities", description: "The entity uses detection and monitoring procedures to identify new vulnerabilities.", autoCheckKey: "vulnerability_scanning", sortOrder: 10 },
  { frameworkKey: "soc2", controlCode: "CC7.2", category: "Incident Monitoring", title: "Monitors system components for anomalies", description: "The entity monitors system components for anomalies indicative of a security event.", autoCheckKey: "intrusion_monitoring", sortOrder: 11 },
  { frameworkKey: "soc2", controlCode: "A1.2", category: "Availability", title: "Environmental protections, backup, and recovery", description: "The entity authorizes, designs, develops, and implements infrastructure, backup, and recovery for availability.", autoCheckKey: "backup_status", sortOrder: 12 },
];

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ComplianceFrameworks' AND xtype='U')
    CREATE TABLE ComplianceFrameworks (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      [Key] VARCHAR(20) NOT NULL UNIQUE,
      Name NVARCHAR(100) NOT NULL,
      Description NVARCHAR(500) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ComplianceControls' AND xtype='U')
    CREATE TABLE ComplianceControls (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      FrameworkId INT NOT NULL,
      ControlCode NVARCHAR(30) NOT NULL,
      Category NVARCHAR(100) NOT NULL,
      Title NVARCHAR(300) NOT NULL,
      Description NVARCHAR(1000) NULL,
      AutoCheckKey VARCHAR(50) NULL,
      SortOrder INT NOT NULL DEFAULT 0,
      Status VARCHAR(20) NOT NULL DEFAULT 'not_started',
      Evidence NVARCHAR(MAX) NULL,
      Notes NVARCHAR(MAX) NULL,
      OwnerUserId INT NULL,
      ReviewedAt DATETIME2 NULL,
      AutoCheckStatus VARCHAR(10) NULL,
      AutoCheckDetail NVARCHAR(500) NULL,
      AutoCheckedAt DATETIME2 NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      CONSTRAINT FK_ComplianceControls_Framework FOREIGN KEY (FrameworkId) REFERENCES ComplianceFrameworks(Id),
      CONSTRAINT CK_ComplianceControls_Status CHECK (Status IN ('not_started', 'in_progress', 'implemented', 'not_applicable')),
      CONSTRAINT CK_ComplianceControls_AutoCheckStatus CHECK (AutoCheckStatus IS NULL OR AutoCheckStatus IN ('pass', 'fail', 'unknown'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ComplianceControls_FrameworkId')
    CREATE INDEX IX_ComplianceControls_FrameworkId ON ComplianceControls (FrameworkId, SortOrder ASC)
  `;

  for (const fw of FRAMEWORKS) {
    await db
      .request()
      .input("key", sql.VarChar, fw.key)
      .input("name", sql.NVarChar, fw.name)
      .input("description", sql.NVarChar, fw.description)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ComplianceFrameworks WHERE [Key] = @key)
        INSERT INTO ComplianceFrameworks ([Key], Name, Description) VALUES (@key, @name, @description)
      `);
  }

  const frameworkIds = await db.query<{ Id: number; Key: string }>`SELECT Id, [Key] FROM ComplianceFrameworks`;
  const idByKey = new Map(frameworkIds.recordset.map((r) => [r.Key, r.Id]));

  let inserted = 0;
  for (const c of CONTROLS) {
    const frameworkId = idByKey.get(c.frameworkKey);
    if (!frameworkId) continue;
    const result = await db
      .request()
      .input("frameworkId", sql.Int, frameworkId)
      .input("controlCode", sql.NVarChar, c.controlCode)
      .input("category", sql.NVarChar, c.category)
      .input("title", sql.NVarChar, c.title)
      .input("description", sql.NVarChar, c.description)
      .input("autoCheckKey", sql.VarChar, c.autoCheckKey)
      .input("sortOrder", sql.Int, c.sortOrder)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ComplianceControls WHERE FrameworkId = @frameworkId AND ControlCode = @controlCode)
        BEGIN
          INSERT INTO ComplianceControls (FrameworkId, ControlCode, Category, Title, Description, AutoCheckKey, SortOrder)
          VALUES (@frameworkId, @controlCode, @category, @title, @description, @autoCheckKey, @sortOrder)
        END
      `);
    if (result.rowsAffected[0] > 0) inserted++;
  }

  console.log(`Compliance schema ready. ${FRAMEWORKS.length} frameworks, ${inserted} new controls inserted (${CONTROLS.length} total defined).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
