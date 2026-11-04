// Pure tree helpers shared by the role-level Menu Access editor (RolesPermissionsPanel) and
// the per-user one (EmployeeAccountsPanel) - both edit the exact same NAV_CATEGORIES-shaped
// tree, just against a different backing table (RoleMenuAccess vs UserMenuAccess).

export interface MenuNode {
  key: string;
  label: string;
  allowed: boolean;
  children?: MenuNode[];
}

export function setAllowedRecursive(node: MenuNode, allowed: boolean): MenuNode {
  return { ...node, allowed, children: node.children?.map((c) => setAllowedRecursive(c, allowed)) };
}

export function updateNodeAllowed(nodes: MenuNode[], targetKey: string, allowed: boolean): MenuNode[] {
  return nodes.map((n) => {
    if (n.key === targetKey) return setAllowedRecursive(n, allowed);
    if (n.children) return { ...n, children: updateNodeAllowed(n.children, targetKey, allowed) };
    return n;
  });
}

export function flattenMenuAccess(nodes: MenuNode[], acc: { key: string; allowed: boolean }[] = []): { key: string; allowed: boolean }[] {
  for (const n of nodes) {
    acc.push({ key: n.key, allowed: n.allowed });
    if (n.children) flattenMenuAccess(n.children, acc);
  }
  return acc;
}
