"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  ListOrdered,
  Megaphone,
  Users,
  Settings,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MicUpLogo } from "@/components/logo";

const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/scripts", label: "Scripts", icon: FileText },
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/run-of-show", label: "Run of Show", icon: ListOrdered },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/announcements", label: "Announcements", icon: Megaphone },
      { href: "/team", label: "Members", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ pendingAnnouncementsPath }: { pendingAnnouncementsPath?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard">
          <MicUpLogo size={26} />
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/announcements" && pendingAnnouncementsPath ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread announcements" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-2.5 py-2 text-xs text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span>Backstage workspace</span>
        </div>
      </div>
    </aside>
  );
}

/** Mobile navigation: horizontal scroll bar under the top bar. */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_SECTIONS.flatMap((s) => s.items);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar px-3 py-2 lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
