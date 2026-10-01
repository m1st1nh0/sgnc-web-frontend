import Page from "@/legacy/pages/InsightsPage";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm", "supervisor"]);
  return <Page />;
}
