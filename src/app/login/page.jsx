import { redirect } from "next/navigation";
import LoginPage from "@/legacy/pages/LoginPage";
import { getUser } from "@/lib/auth/session";

export default async function LoginRoute({ searchParams }) {
  const usuario = await getUser();
  if (usuario) redirect(usuario.senha_provisoria ? "/trocar-senha" : "/");

  const params = await searchParams;
  const successMessage = params?.senhaAlterada === "1"
    ? "Senha alterada com sucesso. Faça login novamente."
    : "";

  return <LoginPage successMessage={successMessage} />;
}
