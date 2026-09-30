import LegacyApplication from "./LegacyApplication";
import { requireUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await requireUser();
  return <LegacyApplication initialUser={{ id: user.id, nome: user.nome, email: user.email, papel: user.papel, senhaProvisoria: user.senha_provisoria }} />;
}
