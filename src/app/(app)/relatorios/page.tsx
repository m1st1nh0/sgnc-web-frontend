import Page from "../../../features/reports/components/RelatoriosPage.jsx";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm", "supervisor"]);
  return <Page />;
}
