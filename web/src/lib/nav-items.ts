import { LayoutDashboard, ClipboardCheck, Compass, ListChecks, Send, Radar, BarChart3, FileText, Settings } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", id: "today", label: "Today", icon: LayoutDashboard },
  { href: "/evaluate", id: "evaluate", label: "Evaluate", icon: ClipboardCheck },
  { href: "/explore", id: "explore", label: "Explore", icon: Compass, chip: "New" },
  { href: "/pipeline", id: "pipeline", label: "Pipeline", icon: ListChecks },
  { href: "/followups", id: "followups", label: "Follow-ups", icon: Send },
  { href: "/portals", id: "portals", label: "Portals", icon: Radar },
  { href: "/analytics", id: "analytics", label: "Analytics", icon: BarChart3 },
  { href: "/cv", id: "cv", label: "CV", icon: FileText },
  { href: "/config", id: "config", label: "Config", icon: Settings },
];

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
