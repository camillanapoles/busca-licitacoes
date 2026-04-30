"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SourceFilterProps = {
  currentFonte?: string;
  sources: {
    code: string;
    name: string;
  }[];
};

export function SourceFilter({ currentFonte, sources }: SourceFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string | null) {
    if (!value) return;

    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete("fonte");
    } else {
      params.set("fonte", value);
    }

    params.delete("page");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select value={currentFonte ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px] gap-2">
        <Filter className="h-4 w-4" />
        <SelectValue placeholder="Origem" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">Todas as origens</SelectItem>
        {sources.map((source) => (
          <SelectItem key={source.code} value={source.code}>
            {source.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
