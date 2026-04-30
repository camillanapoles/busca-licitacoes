"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BellRing, Target, Activity } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/busca?q=${encodeURIComponent(query)}`);
    }
  };

  const suggestions = [
    "software", "sistema de gestão", "saúde", "obras", "equipamentos", "segurança"
  ];

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 bg-gradient-to-b from-primary/10 to-background flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mb-6">
          Encontre oportunidades no <span className="text-primary">setor público</span> com facilidade
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
          O LicitaBusca centraliza as licitações públicas de todo o Brasil. Busque, acompanhe e crie alertas para não perder nenhuma oportunidade de negócio.
        </p>

        {/* Search Bar */}
        <div className="w-full max-w-3xl bg-background rounded-full p-2 shadow-xl flex items-center border">
          <form onSubmit={handleSearch} className="flex-1 flex items-center">
            <Search className="h-6 w-6 text-muted-foreground ml-4" />
            <Input 
              type="text" 
              placeholder="Ex: sistema de gestão, obras, equipamentos..." 
              className="border-0 shadow-none focus-visible:ring-0 text-lg py-6"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" size="lg" className="rounded-full px-8 hidden sm:flex">
              Buscar Licitações
            </Button>
          </form>
        </div>
        
        {/* Mobile search button */}
        <Button onClick={handleSearch} size="lg" className="rounded-full mt-4 w-full max-w-sm sm:hidden">
          Buscar Licitações
        </Button>

        {/* Suggestions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Buscas comuns:</span>
          {suggestions.map((suggestion) => (
            <button 
              key={suggestion}
              onClick={() => {
                setQuery(suggestion);
                router.push(`/busca?q=${encodeURIComponent(suggestion)}`);
              }}
              className="text-xs bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-20 bg-background container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Por que usar o LicitaBusca?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Nossa plataforma foi desenhada para agilizar seu processo de vendas para o governo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center p-6 border rounded-2xl bg-card text-card-foreground shadow-sm">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Busca Inteligente</h3>
            <p className="text-muted-foreground">Encontre editais relevantes usando palavras-chave, filtros por modalidade, localização e valores estimados.</p>
          </div>

          <div className="flex flex-col items-center text-center p-6 border rounded-2xl bg-card text-card-foreground shadow-sm">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BellRing className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Alertas Automáticos</h3>
            <p className="text-muted-foreground">Crie avisos personalizados e seja notificado quando novas licitações do seu interesse forem publicadas.</p>
          </div>

          <div className="flex flex-col items-center text-center p-6 border rounded-2xl bg-card text-card-foreground shadow-sm">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Acompanhamento</h3>
            <p className="text-muted-foreground">Monitore o status das licitações e gerencie todas as suas oportunidades em um painel unificado.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Pronto para encontrar sua próxima grande oportunidade?</h2>
          <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">
            Crie sua conta gratuitamente e comece a monitorar editais em todo o Brasil.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/cadastro">
              <Button size="lg" variant="secondary" className="px-8 rounded-full font-semibold">
                Criar Conta Grátis
              </Button>
            </Link>
            <Link href="/busca">
              <Button size="lg" variant="outline" className="px-8 rounded-full font-semibold border-primary-foreground text-primary hover:bg-primary-foreground/10">
                Ver Licitações Abertas
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
