import Page from "../../../../features/users/components/PessoaEquipePage.jsx";
import { requireRole } from "@/lib/auth/session";

export default async function Route() {
  await requireRole(["adm", "supervisor"]);
  return <Page />;
}
