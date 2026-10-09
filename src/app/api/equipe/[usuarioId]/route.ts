import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { alterarEquipe } from "@/lib/equipes/service";

type Context = { params: Promise<{ usuarioId: string }> };
export async function PATCH(request: Request, context: Context) {
  try { return Response.json(await alterarEquipe((await context.params).usuarioId, await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
