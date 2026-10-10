import Page from "../../../features/users/components/EquipePage.jsx";
import { requireRole } from "@/lib/auth/session";

export default async function Route({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  await requireRole(["adm", "qualidade", "supervisor"]);
  const { aba } = await searchParams;
  return <Page abaInicial={Array.isArray(aba) ? aba[0] : aba} />;
}
