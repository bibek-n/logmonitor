// Predefined categories for the Knowledge Base module - kept free of server-only imports so both
// the API routes (validation) and the client page (dropdowns) can import it directly.
export const KB_CATEGORIES = [
  "Server Configuration",
  "Network Configuration",
  "Application Configuration",
  "Troubleshooting Guide",
  "Software & Licensing",
  "Access & Accounts (non-secret)",
  "Vendor / Contract",
  "Other",
] as const;
