"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, LayoutDashboard, List, Search, Settings } from "lucide-react";

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
    <aside className="w-full md:w-64 md:min-h-screen bg-background border-r flex-shrink-0">
      <div className="sticky top-0">
        <Link href="/" className="flex h-16 items-center gap-2 border-b px-6">
          <Search className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight">LicitaBusca</span>
        </Link>
        <nav className="p-4 space-y-2">
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
      </div>
    </aside>
  );
}
