// Per-browser sidebar customization (move top-level menus and their submenu items up/down),
// persisted the same way as the existing sidebar collapse-rail preference
// (logmonitor-sidebar-collapsed in SidebarShell.tsx) — localStorage, no DB table, since this
// is a personal UI arrangement rather than data other admins need to see.
export const NAV_ORDER_KEY = "logmonitor-sidebar-order";

export interface SidebarOrder {
  topOrder: string[]; // TOP_ITEMS hrefs, custom order
  groupOrder: string[]; // NAV_GROUPS labels, custom order
  itemOrder: Record<string, string[]>; // group label -> item hrefs, custom order
}

export function loadNavOrder(): SidebarOrder {
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return { topOrder: [], groupOrder: [], itemOrder: {} };
    const parsed = JSON.parse(raw);
    return {
      topOrder: Array.isArray(parsed.topOrder) ? parsed.topOrder : [],
      groupOrder: Array.isArray(parsed.groupOrder) ? parsed.groupOrder : [],
      itemOrder: typeof parsed.itemOrder === "object" && parsed.itemOrder ? parsed.itemOrder : {},
    };
  } catch {
    return { topOrder: [], groupOrder: [], itemOrder: {} };
  }
}

export function saveNavOrder(order: SidebarOrder): void {
  localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
}

// Reorders `items` according to a saved list of keys: known keys go first in that order,
// any items not yet in the saved list (new nav entries added after the user last
// customized) are appended at the end in their original order, and stale keys with no
// matching item are silently ignored.
export function applyOrder<T>(items: T[], keyOf: (item: T) => string, savedOrder: string[]): T[] {
  if (savedOrder.length === 0) return items;
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const ordered: T[] = [];
  for (const key of savedOrder) {
    const item = byKey.get(key);
    if (item) {
      ordered.push(item);
      byKey.delete(key);
    }
  }
  for (const item of items) {
    if (byKey.has(keyOf(item))) ordered.push(item);
  }
  return ordered;
}

// Swaps the element at `index` with its neighbor in `direction`, returning a new array
// (no-op if already at the boundary).
export function moveItem<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
