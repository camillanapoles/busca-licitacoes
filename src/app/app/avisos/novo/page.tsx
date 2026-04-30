"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createAviso } from "@/app/actions/avisos";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const avisoSchema = z.object({
  nome: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
  palavrasChave: z.string().min(2, "Insira pelo menos um termo de busca"),
  uf: z.string().optional(),
  modalidade: z.string().optional(),
  frequencia: z.enum(["DIARIA", "SEMANAL", "MANUAL"]).default("DIARIA"),
});

export default function NovoAvisoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultQuery = searchParams.get("q") || "";
  
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof avisoSchema>>({
    resolver: zodResolver(avisoSchema),
    defaultValues: {
      nome: defaultQuery ? `Aviso: ${defaultQuery}` : "",
      palavrasChave: defaultQuery,
      uf: "",
      modalidade: "",
      frequencia: "DIARIA",
    },
  });

  async function onSubmit(values: z.infer<typeof avisoSchema>) {
    setIsLoading(true);
    try {
      await createAviso(values);
      router.push("/app/avisos");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/avisos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Criar Novo Aviso</h1>
          <p className="text-muted-foreground mt-1">Configure o alerta para não perder oportunidades</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Nome do Aviso</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Licitações de Software SP" {...field} />
                    </FormControl>
                    <FormDescription>Um nome amigável para identificar este alerta</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="palavrasChave"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Palavras-chave</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: software, sistema, tecnologia" {...field} />
                    </FormControl>
                    <FormDescription>Termos que devem constar no objeto da licitação</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Estado (UF)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: SP, RJ, MG (Opcional)" maxLength={2} className="uppercase" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequencia"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Frequência do Alerta</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a frequência" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DIARIA">Diária</SelectItem>
                          <SelectItem value="SEMANAL">Semanal</SelectItem>
                          <SelectItem value="MANUAL">Manual (Apenas painel)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 flex justify-end gap-4">
                <Link href="/app/avisos">
                  <Button variant="outline" type="button">Cancelar</Button>
                </Link>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar Aviso"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
