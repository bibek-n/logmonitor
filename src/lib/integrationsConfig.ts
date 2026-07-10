// Phase 1: config storage only, no live OAuth/API calls. Each provider defines the fields
// shown in its settings card and stored (as JSON) in Integrations.ConfigJson — see the
// approved Company Settings plan. Field values are opaque strings (tokens/URLs/ids), never
// validated against the real provider.

export type IntegrationFieldType = "text" | "password" | "url";

export interface IntegrationFieldDef {
  key: string;
  label: string;
  type: IntegrationFieldType;
  placeholder?: string;
}

export interface IntegrationProviderDef {
  key: string;
  label: string;
  description: string;
  fields: IntegrationFieldDef[];
}

export const INTEGRATION_PROVIDERS: IntegrationProviderDef[] = [
  {
    key: "github",
    label: "GitHub",
    description: "Link a repository for issue/PR references (connecting live sync is coming soon).",
    fields: [
      { key: "repoUrl", label: "Repository URL", type: "url", placeholder: "https://github.com/org/repo" },
      { key: "personalAccessToken", label: "Personal Access Token", type: "password" },
      { key: "webhookSecret", label: "Webhook Secret", type: "password" },
    ],
  },
  {
    key: "gitlab",
    label: "GitLab",
    description: "Link a GitLab project (connecting live sync is coming soon).",
    fields: [
      { key: "projectUrl", label: "Project URL", type: "url", placeholder: "https://gitlab.com/org/project" },
      { key: "personalAccessToken", label: "Personal Access Token", type: "password" },
    ],
  },
  {
    key: "jira",
    label: "Jira",
    description: "Link a Jira project for ticket sync (connecting live sync is coming soon).",
    fields: [
      { key: "siteUrl", label: "Jira Site URL", type: "url", placeholder: "https://yourcompany.atlassian.net" },
      { key: "email", label: "Account Email", type: "text" },
      { key: "apiToken", label: "API Token", type: "password" },
    ],
  },
  {
    key: "slack",
    label: "Slack",
    description: "Send notifications to a Slack channel (connecting live delivery is coming soon).",
    fields: [{ key: "webhookUrl", label: "Incoming Webhook URL", type: "url" }],
  },
  {
    key: "teams",
    label: "Microsoft Teams",
    description: "Send notifications to a Teams channel (connecting live delivery is coming soon).",
    fields: [{ key: "webhookUrl", label: "Incoming Webhook URL", type: "url" }],
  },
  {
    key: "google_workspace",
    label: "Google Workspace",
    description: "Link a Google Workspace domain (connecting live SSO/sync is coming soon).",
    fields: [
      { key: "domain", label: "Workspace Domain", type: "text", placeholder: "yourcompany.com" },
      { key: "clientId", label: "OAuth Client ID", type: "text" },
      { key: "clientSecret", label: "OAuth Client Secret", type: "password" },
    ],
  },
  {
    key: "azure_ad",
    label: "Microsoft Azure Active Directory",
    description: "Link an Azure AD tenant for SSO (connecting live SSO is coming soon).",
    fields: [
      { key: "tenantId", label: "Tenant ID", type: "text" },
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    key: "webhook",
    label: "Webhooks",
    description: "Send system events to a custom webhook endpoint.",
    fields: [
      { key: "endpointUrl", label: "Endpoint URL", type: "url" },
      { key: "secret", label: "Signing Secret", type: "password" },
    ],
  },
  {
    key: "custom_api",
    label: "Custom API Integration",
    description: "Store credentials for a custom-built integration.",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url" },
      { key: "apiKey", label: "API Key", type: "password" },
    ],
  },
];

export function getIntegrationProvider(key: string): IntegrationProviderDef | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.key === key);
}
