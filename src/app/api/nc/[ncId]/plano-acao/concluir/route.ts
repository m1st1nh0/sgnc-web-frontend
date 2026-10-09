import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { concluirPlanoAcao } from "@/lib/nc/plano-acao";

type Context = { params: Promise<{ ncId: string }> };
export async function POST(request: Request, context: Context) {
  try { return Response.json(await concluirPlanoAcao(Number((await context.params).ncId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
