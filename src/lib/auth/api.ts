import "server-only";
import { getUser } from "./session";
import { assertApiUser } from "./policy";
export async function requireApiUser(options: { allowTemporaryPassword?: boolean } = {}) {
  return assertApiUser(await getUser(), options);
}
