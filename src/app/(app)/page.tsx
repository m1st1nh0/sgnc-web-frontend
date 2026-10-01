import Page from "@/legacy/pages/HomePage";
import { requireUser } from "@/lib/auth/session";
export default async function Route() {
  await requireUser();
  return <Page />;
}
