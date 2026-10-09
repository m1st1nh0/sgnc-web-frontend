import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { registrarAcompanhamento } from "@/lib/nc/plano-acao";

type Context = { params: Promise<{ ncId: string }> };
export async function POST(request: Request, context: Context) {
  try { return Response.json(await registrarAcompanhamento(Number((await context.params).ncId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
