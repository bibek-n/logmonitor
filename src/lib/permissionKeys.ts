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
];
