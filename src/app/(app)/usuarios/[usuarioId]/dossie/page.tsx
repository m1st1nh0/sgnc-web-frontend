import Page from "../../../../../features/users/components/EstatisticasUsuarioPage.jsx";
import { requireUser } from "@/lib/auth/session";
export default async function Route() {
  await requireUser();
  return <Page />;
}
