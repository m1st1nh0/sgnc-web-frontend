import { apiErrorResponse } from "@/lib/api/error";
import { marcarNotificacaoLida } from "@/lib/notificacoes/service";

type Context = { params: Promise<{ notificacaoId: string }> };
export async function POST(_request: Request, context: Context) {
  try { return Response.json(await marcarNotificacaoLida(Number((await context.params).notificacaoId))); }
  catch (error) { return apiErrorResponse(error); }
}
