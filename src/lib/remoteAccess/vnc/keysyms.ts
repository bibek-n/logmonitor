// Maps a browser KeyboardEvent's `key` value to the X11 keysym code RFB's KeyEvent message
// expects. For any single-character key (letters, digits, punctuation, space, and Latin-1
// accented characters), the keysym equals the Unicode code point directly - X11 defines the
// Latin-1 keysym range (0x00a0-0x00ff) as numerically identical to Unicode/ISO-8859-1, and the
// ASCII printable range below that lines up the same way. Named keys (Enter, arrows, F-keys,
// modifiers, ...) need an explicit table since their `key` strings don't carry a code point.
const NAMED_KEYSYMS: Record<string, number> = {
  Backspace: 0xff08,
  Tab: 0xff09,
  Enter: 0xff0d,
  Escape: 0xff1b,
  Delete: 0xffff,
  Insert: 0xff63,
  Home: 0xff50,
  End: 0xff57,
  PageUp: 0xff55,
  PageDown: 0xff56,
  ArrowLeft: 0xff51,
  ArrowUp: 0xff52,
  ArrowRight: 0xff53,
  ArrowDown: 0xff54,
  Shift: 0xffe1,
  Control: 0xffe3,
  Alt: 0xffe9,
  AltGraph: 0xfe03,
  Meta: 0xffeb,
  OS: 0xffeb,
  CapsLock: 0xffe5,
  NumLock: 0xff7f,
  ScrollLock: 0xff14,
  Pause: 0xff13,
  PrintScreen: 0xff61,
  ContextMenu: 0xff67,
  F1: 0xffbe,
  F2: 0xffbf,
  F3: 0xffc0,
  F4: 0xffc1,
  F5: 0xffc2,
  F6: 0xffc3,
  F7: 0xffc4,
  F8: 0xffc5,
  F9: 0xffc6,
  F10: 0xffc7,
  F11: 0xffc8,
  F12: 0xffc9,
};

// Covers everyday admin usage (typing, navigation, shortcuts via Ctrl/Alt/Shift). Does not
// cover dead keys, IME composition, or non-Latin-1 international layouts - a documented
// limitation, not an oversight (this app's WinRM Terminal has an analogous documented input
// limitation for the same "scope this to what a polling-based admin tool actually needs" reason).
export function keyToKeysym(key: string): number | null {
  if (key.length === 1) return key.codePointAt(0) ?? null;
  return NAMED_KEYSYMS[key] ?? null;
}
