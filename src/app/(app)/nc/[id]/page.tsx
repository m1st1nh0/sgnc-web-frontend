import Page from "@/legacy/pages/DetalhesNcPage";
import { requireUser } from "@/lib/auth/session";
export default async function Route() {
  await requireUser();
  return <Page />;
}
