import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1" style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={13} style={{ opacity: 0.6 }} />}
          {item.href ? (
            <Link href={item.href} style={{ color: "var(--ink-muted)" }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: "var(--ink)", fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
