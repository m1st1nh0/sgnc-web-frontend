import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import Providers from "./providers";
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <Providers initialUser={{ id: user.id, nome: user.nome, email: user.email, papel: user.papel, senhaProvisoria: user.senha_provisoria }}>{children}</Providers>;
}
