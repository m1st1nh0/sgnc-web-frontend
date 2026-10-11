import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { salvarDepartamento } from "@/lib/estrutura/service";

type Context = { params: Promise<{ departamentoId: string }> };
export async function PATCH(request: Request, context: Context) {
  try { return Response.json(await salvarDepartamento((await context.params).departamentoId, await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
