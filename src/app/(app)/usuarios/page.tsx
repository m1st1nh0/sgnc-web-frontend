import Page from "@/legacy/pages/UsuariosPage";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm"]);
  return <Page />;
}
