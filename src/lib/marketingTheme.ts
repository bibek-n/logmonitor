// The public marketing site intentionally uses its own fixed palette rather than the
// dashboard's user-selectable theme system (globals.css's `:root[data-theme="..."]` blocks
// only apply when that attribute is on <html>, so they can't be scoped to a subtree anyway).
// Updated 2026-11-05 to match the login page's brand look (deep green backdrop, purple
// surfaces, white ink) — the same combination now used as the dashboard's default theme too,
// so the public site (Support, Contact, About, etc.) reads consistently with the product
// instead of the previous clean-light palette.
//
// `primary`/`primaryDark` resolve through CSS custom properties so that Company Settings >
// Branding can override them without touching every consumer of MKT: see
// src/components/marketing/BrandColorStyle.tsx, which injects `--mkt-primary`/
// `--mkt-primary-dark` from CompanySettings.PrimaryColor/SecondaryColor when set. The
// hex fallback here is what renders when no override is configured.
export const MKT = {
  primary: "var(--mkt-primary, #8B5CF6)",
  primaryDark: "var(--mkt-primary-dark, #6D28D9)",
  bg: "#0A1F16",
  surface: "#1A1130",
  surfaceAlt: "#251A42",
  ink: "#FFFFFF",
  inkMuted: "#C9BFE0",
  border: "rgba(168, 85, 247, 0.22)",
  success: "#22C55E",
  accentYellow: "#FACC15",
};
