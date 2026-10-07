import "server-only";
import { getUser } from "./session";
import { assertApiUser, assertRole } from "./policy";
export async function requireApiUser(options: { allowTemporaryPassword?: boolean } = {}) {
  return assertApiUser(await getUser(), options);
}
export async function requireApiAdmin() { return assertRole(await requireApiUser(), ["adm"]); }
