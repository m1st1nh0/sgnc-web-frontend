import { apiErrorResponse } from "@/lib/api/error";
import { listarNotificacoes } from "@/lib/notificacoes/service";

export async function GET() {
  try { return Response.json(await listarNotificacoes()); }
  catch (error) { return apiErrorResponse(error); }
}
