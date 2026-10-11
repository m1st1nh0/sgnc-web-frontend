import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";

// Usuários virou a aba "Acessos" de Pessoas e equipes; o endereço antigo continua valendo.
export default async function Route() {
  await requireRole(["adm"]);
  redirect("/equipe?aba=acessos");
}
