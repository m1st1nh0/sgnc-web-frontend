import Page from "@/legacy/pages/RelatoriosPage";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm", "supervisor"]);
  return <Page />;
}
