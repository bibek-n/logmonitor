import {
  ShieldCheck,
  Network,
  HardDrive,
  Users,
  LifeBuoy,
  Ticket,
  Activity,
  Lock,
  LayoutDashboard,
  Zap,
  Cloud,
  TrendingUp,
  KeyRound,
  FileText,
  Clock,
  type LucideIcon,
} from "lucide-react";

// Maps the plain icon-name strings in src/lib/websiteContent.ts to actual components —
// keeps that file free of framework/JSX concerns so it stays a clean data file.
const ICONS: Record<string, LucideIcon> = {
  ShieldCheck,
  Network,
  HardDrive,
  Users,
  LifeBuoy,
  Ticket,
  Activity,
  Lock,
  LayoutDashboard,
  Zap,
  Cloud,
  TrendingUp,
  KeyRound,
  FileText,
  Clock,
};

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? ShieldCheck;
}
