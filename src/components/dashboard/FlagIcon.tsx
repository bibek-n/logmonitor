// Renders a real flag image instead of a Unicode flag emoji. Windows historically doesn't
// ship colored flag glyphs in its system emoji font (Segoe UI Emoji renders the two regional-
// indicator characters as bare letters in boxes, e.g. "NP", not an actual flag) — a real image
// renders identically everywhere regardless of OS/browser font support.
export function FlagIcon({ code, label, size = 16 }: { code: string; label: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={`${label} flag`}
      loading="lazy"
      style={{ height: size, width: "auto", borderRadius: 2, verticalAlign: "middle", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}
    />
  );
}
