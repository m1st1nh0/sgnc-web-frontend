import { ApiError } from "../api/error";
import type { PapelUsuario, UsuarioAutenticado } from "./types";
export function assertApiUser(user: UsuarioAutenticado | null, options: { allowTemporaryPassword?: boolean } = {}): UsuarioAutenticado {
  if (!user || !user.ativo || !["adm", "supervisor", "funcionario"].includes(user.papel)) throw new ApiError("Sessão inválida ou expirada. Faça login novamente.", 401);
  if (!options.allowTemporaryPassword && user.senha_provisoria) throw new ApiError("Troque a senha provisória antes de continuar.", 403);
  return user;
}
export function assertRole(user: UsuarioAutenticado, roles: PapelUsuario[]) {
  assertApiUser(user);
  if (!roles.includes(user.papel)) throw new ApiError("Acesso não permitido para este perfil.", 403);
  return user;
}
