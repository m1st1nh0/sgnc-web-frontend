import Page from "../../../features/reports/components/RelatoriosPage.jsx";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm", "qualidade", "supervisor"]);
  return <Page />;
}
