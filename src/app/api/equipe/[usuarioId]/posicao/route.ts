import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { alterarPosicao } from "@/lib/estrutura/service";

type Context = { params: Promise<{ usuarioId: string }> };
export async function PATCH(request: Request, context: Context) {
  try { return Response.json(await alterarPosicao((await context.params).usuarioId, await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
