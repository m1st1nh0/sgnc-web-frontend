import { apiErrorResponse } from "@/lib/api/error";
import { marcarTodasLidas } from "@/lib/notificacoes/service";

export async function POST() {
  try { return Response.json(await marcarTodasLidas()); }
  catch (error) { return apiErrorResponse(error); }
}
