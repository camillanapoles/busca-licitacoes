"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";

import {
  testWhatsappSettings,
  updateWhatsappSettings,
  type WhatsappSettingsInput,
} from "@/app/actions/configuracoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WhatsappSettingsFormProps = {
  whatsappNumber: string;
  whatsappNotificationsEnabled: boolean;
  hasBearerToken: boolean;
  hasDeviceToken: boolean;
};

export function WhatsappSettingsForm({
  whatsappNumber,
  whatsappNotificationsEnabled,
  hasBearerToken,
  hasDeviceToken,
}: WhatsappSettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(whatsappNotificationsEnabled);
  const [number, setNumber] = useState(whatsappNumber);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setNumber(whatsappNumber);
  }, [whatsappNumber]);

  function getInputFromFormData(formData: FormData): WhatsappSettingsInput {
    return {
      whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
      whatsappNotificationsEnabled: formData.get("whatsappNotificationsEnabled") === "on",
      bearerToken: String(formData.get("bearerToken") ?? ""),
      deviceToken: String(formData.get("deviceToken") ?? ""),
    };
  }

  async function onSubmit(formData: FormData) {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const result = await updateWhatsappSettings(getInputFromFormData(formData));
      setMessage(result.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onTest() {
    if (!formRef.current) {
      return;
    }

    setIsTesting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await testWhatsappSettings(getInputFromFormData(new FormData(formRef.current)));
      if (result.success) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Erro ao enviar mensagem de teste.");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Notificações por WhatsApp
        </CardTitle>
        <CardDescription>
          Configure suas credenciais da APIBrasil para receber avisos novos no WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={onSubmit} className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <input
              id="whatsappNotificationsEnabled"
              name="whatsappNotificationsEnabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div className="space-y-1">
              <Label htmlFor="whatsappNotificationsEnabled">Ativar notificações</Label>
              <p className="text-sm text-muted-foreground">
                Quando novos resultados forem encontrados para seus avisos, o sistema enviará uma mensagem pelo WhatsApp.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">Número de destino</Label>
              <Input
                id="whatsappNumber"
                name="whatsappNumber"
                inputMode="numeric"
                placeholder="5531999999999"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Use DDI + DDD + número, somente dígitos.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceToken">DeviceToken APIBrasil</Label>
              <Input
                id="deviceToken"
                name="deviceToken"
                type="password"
                placeholder={hasDeviceToken ? "Token já configurado" : "Cole seu DeviceToken"}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter o token salvo.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bearerToken">Bearer token APIBrasil</Label>
            <Input
              id="bearerToken"
              name="bearerToken"
              type="password"
              placeholder={hasBearerToken ? "Token já configurado" : "Cole o Bearer token"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              O token é armazenado criptografado e não será exibido novamente.
            </p>
          </div>

          {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
          {error && <p className="whitespace-pre-wrap break-words text-sm font-medium text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSaving || isTesting} onClick={onTest}>
              {isTesting ? "Enviando teste..." : "Enviar teste"}
            </Button>
            <Button type="submit" disabled={isSaving || isTesting}>
              {isSaving ? "Salvando..." : "Salvar configurações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
