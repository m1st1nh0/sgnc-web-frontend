import Page from "@/features/nc/components/CausasPage.jsx";
import { requireRole } from "@/lib/auth/session";

export default async function Route() {
  await requireRole(["adm"]);
  return <Page />;
}
