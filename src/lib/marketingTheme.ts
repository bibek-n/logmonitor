// The public marketing site intentionally uses its own fixed light palette rather than
// the dashboard's user-selectable theme system (globals.css's `:root[data-theme="..."]`
// blocks only apply when that attribute is on <html>, so they can't be scoped to a
// subtree anyway) — a first-time visitor has no theme preference, and a security-product
// marketing site reads better in a clean light look regardless. The blue is the exact
// accent (#3B82F6) already established as this app's brand color in the dashboard.
//
// `primary`/`primaryDark` resolve through CSS custom properties so that Company Settings >
// Branding can override them without touching every consumer of MKT: see
// src/components/marketing/BrandColorStyle.tsx, which injects `--mkt-primary`/
// `--mkt-primary-dark` from CompanySettings.PrimaryColor/SecondaryColor when set. The
// hex fallback here is what renders when no override is configured.
export const MKT = {
  primary: "var(--mkt-primary, #3B82F6)",
  primaryDark: "var(--mkt-primary-dark, #2563EB)",
  bg: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceAlt: "#F1F5F9",
  ink: "#0F172A",
  inkMuted: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
};
