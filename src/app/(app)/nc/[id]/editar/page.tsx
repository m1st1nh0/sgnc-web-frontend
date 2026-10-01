import Page from "@/legacy/pages/EditarNcPage";
import { requireRole } from "@/lib/auth/session";
export default async function Route() {
  await requireRole(["adm"]);
  return <Page />;
}
