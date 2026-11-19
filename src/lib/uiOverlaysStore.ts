import { create } from "zustand";

// Tiny shared UI-overlay state so pieces of the dashboard shell that don't otherwise share a
// parent (CommandPalette, ShortcutsOverlay) can open one another — e.g. a command-palette quick
// action opening the shortcuts cheat-sheet — without prop drilling through DashShellClient.
interface UiOverlaysState {
  shortcutsOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
}

export const useUiOverlays = create<UiOverlaysState>((set) => ({
  shortcutsOpen: false,
  openShortcuts: () => set({ shortcutsOpen: true }),
  closeShortcuts: () => set({ shortcutsOpen: false }),
}));
