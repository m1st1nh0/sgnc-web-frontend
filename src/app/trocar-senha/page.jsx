import { redirect } from "next/navigation";
import TrocarSenhaPage from "@/legacy/pages/TrocarSenhaPage";
import { getUser } from "@/lib/auth/session";

export default async function TrocarSenhaRoute() {
  const usuario = await getUser();
  if (!usuario) redirect("/login");
  if (!usuario.senha_provisoria) redirect("/");
  return <TrocarSenhaPage />;
}
