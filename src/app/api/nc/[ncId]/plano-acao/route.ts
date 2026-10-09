import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { obterPlanoAcao, salvarPlanoAcao } from "@/lib/nc/plano-acao";

type Context = { params: Promise<{ ncId: string }> };
const idFrom = async (context: Context) => Number((await context.params).ncId);

export async function GET(_request: Request, context: Context) {
  try { return Response.json(await obterPlanoAcao(await idFrom(context))); } catch (error) { return apiErrorResponse(error); }
}
export async function PUT(request: Request, context: Context) {
  try { return Response.json(await salvarPlanoAcao(await idFrom(context), await readJson(request))); } catch (error) { return apiErrorResponse(error); }
}
