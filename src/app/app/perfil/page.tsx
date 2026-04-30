import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { User, Mail, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WhatsappSettingsForm } from "./whatsapp-settings-form";

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      whatsappNumber: true,
      whatsappNotificationsEnabled: true,
      apibrasilBearerTokenEncrypted: true,
      apibrasilDeviceTokenEncrypted: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações de Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações e preferências de conta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
          <CardDescription>Dados básicos da sua conta no LicitaBusca.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nome completo</p>
              <p className="text-lg font-semibold">{session.user.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                E-mail
              </div>
              <p className="font-medium">{session.user.email}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Cargo/Role
              </div>
              <p className="font-medium">{session.user.role || "Usuário"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <WhatsappSettingsForm
        whatsappNumber={user?.whatsappNumber ?? ""}
        whatsappNotificationsEnabled={user?.whatsappNotificationsEnabled ?? false}
        hasBearerToken={Boolean(user?.apibrasilBearerTokenEncrypted)}
        hasDeviceToken={Boolean(user?.apibrasilDeviceTokenEncrypted)}
      />

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          <CardDescription>Ações irreversíveis na sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Uma vez deletada, sua conta e todos os seus avisos e resultados salvos serão permanentemente removidos.
          </p>
          <button className="text-sm font-semibold text-destructive hover:underline">
            Excluir minha conta permanentemente
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
