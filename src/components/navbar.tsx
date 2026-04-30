"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [hasSidebar, setHasSidebar] = useState(false);

  useEffect(() => {
    setHasSidebar(pathname.startsWith("/app") || pathname.startsWith("/admin"));
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        hasSidebar && "md:ml-64 md:w-[calc(100%-16rem)]"
      )}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-end">
        <nav className="flex items-center space-x-4">
          <Link href="/busca" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Buscar
          </Link>
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                    <span className="sr-only">Menu do usuário</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{session.user?.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href="/app">Dashboard</Link>} />
                  <DropdownMenuItem render={<Link href="/app/avisos">Meus Avisos</Link>} />
                  {session.user?.role === "ADMIN" && (
                    <DropdownMenuItem render={<Link href="/admin">Painel Admin</Link>} />
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/cadastro">
                <Button>Criar Conta</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
