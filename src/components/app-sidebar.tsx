"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, LayoutDashboard, List, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  {
    href: "/app",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/app/avisos",
    label: "Meus Avisos",
    icon: BellRing,
  },
  {
    href: "/app/resultados",
    label: "Resultados",
    icon: List,
  },
  {
    href: "/app/perfil",
    label: "Configurações",
    icon: Settings,
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-64 bg-background border-r flex-shrink-0">
      <nav className="p-4 space-y-2 sticky top-20">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-foreground transition-colors",
                isActive && "bg-muted font-semibold"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 text-muted-foreground",
                  isActive && "text-foreground"
                )}
              />
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
