import { apiErrorResponse } from "@/lib/api/error";
import { listarHistoricoEquipe } from "@/lib/equipes/service";

type Context = { params: Promise<{ usuarioId: string }> };
export async function GET(_request: Request, context: Context) {
  try { return Response.json(await listarHistoricoEquipe((await context.params).usuarioId)); }
  catch (error) { return apiErrorResponse(error); }
}
