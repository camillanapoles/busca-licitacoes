"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchFilterFormProps = {
  q?: string;
};

export function SearchFilterForm({ q }: SearchFilterFormProps) {
  const [query, setQuery] = useState(q ?? "");

  useEffect(() => {
    setQuery(q ?? "");
  }, [q]);

  return (
    <form method="GET" action="/busca" className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="q" className="text-sm font-medium">
          Palavra-chave
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="q"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Objeto, órgão..."
            className="pl-9"
          />
        </div>
      </div>
      <Button type="submit" className="w-full">
        Filtrar
      </Button>
    </form>
  );
}
