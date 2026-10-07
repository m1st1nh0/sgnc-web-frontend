import { apiErrorResponse } from "@/lib/api/error";
import { requireApiUser } from "@/lib/auth/api";
import { listarPessoasGerenciaveis } from "@/lib/permissions/team-scope";

export async function GET() {
  try {
    const user = await requireApiUser();
    return Response.json(await listarPessoasGerenciaveis(user));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
