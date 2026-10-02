import Page from "../../../../features/nc/components/DetalhesNcPage.jsx";
import { requireUser } from "@/lib/auth/session";
export default async function Route({ searchParams }: { searchParams: Promise<{ retorno?: string | string[] }> }) {
  await requireUser();
  const params = await searchParams;
  const retorno = params.retorno === "/relatorios" ? "/relatorios" : "/";
  return <Page retorno={retorno} />;
}
