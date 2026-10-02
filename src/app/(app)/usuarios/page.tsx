import Page from "../../../features/users/components/UsuariosPage.jsx";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm"]);
  return <Page />;
}
