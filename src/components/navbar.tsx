"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserCircle } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Search className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight">LicitaBusca</span>
        </Link>
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
