import {
  Activity,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileBarChart,
  GitBranch,
  LayoutDashboard,
  Map,
  Scale,
  Settings2,
} from "lucide-react";

export const workspaceNavigation = [
  { href: "/command-center", label: "Command Center", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: BriefcaseBusiness },
  { href: "/jurisdictions", label: "Jurisdiction Lens", icon: Scale },
  { href: "/formation", label: "Formation", icon: GitBranch },
  { href: "/compliance", label: "Compliance", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/engagements", label: "Engagements", icon: Activity },
] as const;

export const systemNavigation = [
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

export const productModules = [
  { key: "clients", label: "Client Intake", href: "/clients", status: "operational" },
  { key: "business-profile", label: "Business Profile", href: "/clients", status: "foundation" },
  { key: "jurisdiction", label: "Jurisdiction Lens", href: "/jurisdictions", status: "foundation" },
  { key: "formation", label: "Formation Roadmap", href: "/formation", status: "foundation" },
  { key: "compliance", label: "Compliance", href: "/compliance", status: "foundation" },
  { key: "reports", label: "Report Generator", href: "/reports", status: "foundation" },
  { key: "engagements", label: "Engagement Records", href: "/engagements", status: "foundation" },
] as const;
