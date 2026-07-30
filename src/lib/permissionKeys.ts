// Stored, unenforced permission flags — see the approved Company Settings plan. This lets
// an admin describe what a role *should* be allowed to do; wiring real enforcement across
// the rest of the app is a later phase.
export const PERMISSION_KEYS = [
  "view_dashboard",
  "manage_endpoint_agents",
  "manage_router_sophos",
  "manage_website_content",
  "manage_support_tickets",
  "manage_company_settings",
  // QA Testing Management module — the first set of keys in this list that's actually
  // enforced at request time (via requireQaPermission()), scoped only to /api/admin/qa/**
  // routes. Admin bypasses these entirely (same superuser convention as requireAdmin()).
  "qa_view",
  "qa_create",
  "qa_edit",
  "qa_delete",
  "qa_execute",
  "qa_manage_runs",
  "qa_manage_bugs",
  "qa_view_reports",
  "qa_admin",
  // Code Quality module — enforced via requireCodeQualityPermission(), scoped only to
  // /api/admin/code-quality/** routes. Same superuser convention: Admin bypasses these.
  "cq_view",
  "cq_project_create",
  "cq_project_update",
  "cq_project_delete",
  "cq_scan_start",
  "cq_scan_cancel",
  "cq_issue_update",
  "cq_settings_manage",
  "cq_export",
  // Shared repo connections (GitHub/GitLab) - used by requireIntegrationPermission(), scoped
  // to /api/admin/integrations/git/** and reused by every module that syncs a project from a
  // repo (Code Quality, Laravel Security, and future ones), instead of each module owning its
  // own duplicate "who can manage connections" key (superseded cq_github_manage/
  // cq_gitlab_manage - no other module had shipped yet, so no migration of role grants needed).
  "integrations_git_view",
  "integrations_git_manage",
  // Laravel Security module — enforced via requireLaravelSecurityPermission(), scoped only to
  // /api/admin/laravel-security/** routes. Same superuser convention: Admin bypasses these.
  "ls_view",
  "ls_project_create",
  "ls_project_update",
  "ls_project_delete",
  "ls_scan_start",
  "ls_scan_cancel",
  "ls_issue_update",
  "ls_settings_manage",
  "ls_export",
  // Mail File Blocking / Mail Protection module — enforced via
  // requireMailPolicyPermission(), scoped only to /api/admin/mail-security/** routes. Same
  // superuser convention: Admin bypasses these.
  "mail_view",
  "mail_policy_create",
  "mail_policy_update",
  "mail_policy_delete",
  "mail_policy_enable",
  "mail_manage_exceptions",
  "mail_view_incidents",
  "mail_release_quarantine",
  "mail_manage_templates",
  "mail_manage_connectors",
  "mail_export",
  // Website & API Monitoring module — enforced via requireMonitoringPermission(), scoped
  // only to /api/admin/monitoring/** routes. Same superuser convention: Admin bypasses these.
  "mon_view",
  "mon_website_create",
  "mon_website_edit",
  "mon_website_delete",
  "mon_api_create",
  "mon_api_edit",
  "mon_api_delete",
  "mon_test",
  "mon_pause_resume",
  "mon_incidents_view",
  "mon_incidents_manage",
  "mon_alert_contacts_view",
  "mon_alert_contacts_manage",
  "mon_alert_policies_manage",
  "mon_maintenance_manage",
  "mon_ssl_view",
  "mon_reports_view",
  "mon_settings_manage",
  // Automation module — enforced via requireAutomationPermission(), scoped only to
  // /api/admin/automation/** routes. Same superuser convention: Admin bypasses these. Scripts
  // run with full SYSTEM/root privilege on every enrolled endpoint agent (see
  // agent/automation.go), so auto_job_run and auto_schedule_manage are treated as sensitively
  // as cq_scan_start/ls_scan_start elsewhere in this list, not as casually as a plain view key.
  "auto_view",
  "auto_script_manage",
  "auto_job_run",
  "auto_schedule_manage",
  // Security Center module — enforced via requireSecurityCenterPermission(), scoped only to
  // /api/admin/security-center/** routes. Prefix `sc_` is deliberately distinct from
  // Intrusion Detection's own separate SecurityUserRoles/requireSecurityRole system (which
  // continues to gate the pre-existing Security Center nav items - Intrusion Detection, DDos
  // Detection, etc.) - the two systems are not merged, per the approved plan.
  "sc_view",
  "sc_vuln_scan_run",
  "sc_vuln_finding_update",
  "sc_waf_manage",
  "sc_settings_manage",
  // Remote Access module — enforced via requireRemoteAccessPermission(), scoped only to
  // /api/admin/remote-access/** routes. Same superuser convention: Admin bypasses these. Every
  // key here gates something that can reach real infrastructure (SSH/RDP/VNC sessions, a
  // credentials vault, remote command execution, device restart/shutdown), so this list is
  // deliberately more granular than most other modules' permission sets.
  "ra_view",
  "ra_connections_view",
  "ra_connections_create",
  "ra_connections_edit",
  "ra_connections_delete",
  "ra_ssh_start",
  "ra_rdp_start",
  "ra_vnc_start",
  "ra_file_transfer_use",
  "ra_file_upload",
  "ra_file_download",
  "ra_file_delete",
  "ra_credentials_use",
  "ra_credentials_reveal",
  "ra_credentials_manage",
  "ra_ssh_keys_manage",
  "ra_commands_execute",
  "ra_scripts_execute",
  "ra_bulk_execute",
  "ra_device_restart",
  "ra_device_shutdown",
  "ra_session_logs_view",
  "ra_audit_logs_view",
  "ra_settings_manage",
  "ra_port_forwarding_manage",
  // IT Asset Logsheet module — enforced via requireItAssetPermission(), scoped only to
  // /api/admin/it-asset-logsheet/** routes. Role mapping intended for admins ticking
  // RolePermissions in the existing role editor: Administrator = every key including
  // ita_asset_delete/ita_settings_manage/ita_audit_view; IT Technician = everything except
  // those three (can create/edit/log activity, cannot hard-delete or reconfigure); Auditor =
  // ita_view + ita_reports_view + ita_export only (read-only, per the spec's three roles).
  "ita_view",
  "ita_asset_create",
  "ita_asset_edit",
  "ita_asset_delete",
  "ita_password_manage",
  "ita_patch_manage",
  "ita_software_manage",
  "ita_maintenance_manage",
  "ita_attachment_manage",
  "ita_import",
  "ita_export",
  "ita_reports_view",
  "ita_alerts_manage",
  "ita_settings_manage",
  "ita_audit_view",
  // Browser Activity Audit module — enforced via requireBrowserActivityPermission(), scoped
  // only to /api/admin/browser-activity/** routes. Same superuser convention: Admin bypasses
  // these. This is a monitoring module where *viewing/searching/exporting* is itself the
  // sensitive action (not just mutations), so the key set separates plain viewing
  // (ba_view) from seeing unmasked page titles (ba_view_page_titles), from exporting
  // (ba_export) — letting a role see aggregate activity without ever seeing titles or being
  // able to export. Suggested grants for the four requested roles (Super Admin/Security
  // Administrator/HR Reviewer/Read-only Auditor) are documented on the module's policy page,
  // not hardcoded here — roles are just RolePermissions rows an admin ticks, per convention.
  "ba_view",
  "ba_view_page_titles",
  "ba_view_security_alerts",
  "ba_search",
  "ba_export",
  "ba_categories_manage",
  "ba_excluded_domains_manage",
  "ba_settings_manage",
  "ba_device_enable",
  "ba_audit_log_view",
  "ba_delete",
];
