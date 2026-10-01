import Page from "../../features/nc/components/HomePage.jsx";
import { requireUser } from "@/lib/auth/session";
export default async function Route() {
  await requireUser();
  return <Page />;
}
