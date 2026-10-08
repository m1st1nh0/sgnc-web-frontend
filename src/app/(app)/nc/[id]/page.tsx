import Page from "../../../../features/nc/components/DetalhesNcPage.jsx";
import { requireUser } from "@/lib/auth/session";
import { normalizarRetorno } from "@/lib/utils/retorno.js";
export default async function Route({ searchParams }: { searchParams: Promise<{ retorno?: string | string[] }> }) {
  await requireUser();
  const params = await searchParams;
  return <Page retorno={normalizarRetorno(params.retorno)} />;
}
