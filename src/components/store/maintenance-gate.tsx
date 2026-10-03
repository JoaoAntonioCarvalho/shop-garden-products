import type { ReactNode } from "react";
import { Logo } from "@/components/store/logo";
import { isStaff } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { formatPhone } from "@/lib/validators/phone";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { getStoreSettings } from "@/server/services/settings";

/**
 * Modo manutenção (Configurações do painel): a loja e o checkout mostram "Voltamos em breve".
 * A equipe logada continua vendo a loja, e a página de login continua acessível.
 */
export async function MaintenanceGate({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  if (!settings.maintenanceMode) return children;
  if (isStaff(await getCurrentUser())) return children;
  return (
    <main
      id="conteudo"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-cream-50 px-4 py-16 text-center"
    >
      <Logo name={settings.name} />
      <h1 className="font-serif text-[40px] leading-tight font-semibold text-moss-900">
        Voltamos em breve
      </h1>
      <p className="max-w-md type-body text-ink">
        Estamos fazendo uma melhoria na loja. Enquanto isso, o atendimento continua pelo WhatsApp e
        por e-mail.
      </p>
      <p className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a
          href={buildWhatsAppUrl(settings.whatsapp, `Olá! Vim pelo site da ${settings.name}.`)}
          className="text-moss-700 underline underline-offset-4"
        >
          WhatsApp {settings.phoneDisplay || formatPhone(settings.whatsapp)}
        </a>
        <a href={`mailto:${settings.email}`} className="text-moss-700 underline underline-offset-4">
          {settings.email}
        </a>
      </p>
    </main>
  );
}
