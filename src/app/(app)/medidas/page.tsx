import Page from "@/features/nc/components/MedidasPage.jsx";
import { requireRole } from "@/lib/auth/session";

export default async function Route() {
  await requireRole(["adm", "qualidade"]);
  return <Page />;
}
