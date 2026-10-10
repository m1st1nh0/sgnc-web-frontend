import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { decidirMedida } from "@/lib/nc/medidas";

type Context = { params: Promise<{ medidaId: string }> };
export async function POST(request: Request, context: Context) {
  try { return Response.json(await decidirMedida(Number((await context.params).medidaId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
