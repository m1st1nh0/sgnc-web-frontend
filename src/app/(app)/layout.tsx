import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import Providers from "./providers";
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // Preferência da sidebar no desktop, lida no servidor para não piscar na hidratação.
  const navCompacta = (await cookies()).get("sg-nav")?.value === "compacta";
  return <Providers navCompacta={navCompacta} initialUser={{ id: user.id, nome: user.nome, email: user.email, papel: user.papel, senhaProvisoria: user.senha_provisoria }}>{children}</Providers>;
}
