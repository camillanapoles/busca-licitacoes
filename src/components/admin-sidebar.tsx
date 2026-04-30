"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, FileText, LayoutDashboard, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    icon: Users,
  },
  {
    href: "/admin/licitacoes",
    label: "Licitações",
    icon: FileText,
  },
  {
    href: "/admin/coletas",
    label: "Logs de Coleta",
    icon: Database,
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Admin Panel</h2>
      </div>
      <nav className="px-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors",
                isActive && "bg-slate-800 text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
