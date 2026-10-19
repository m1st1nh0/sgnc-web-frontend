import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { registrarAnaliseCausa } from "@/lib/nc/prazos";

type Context = { params: Promise<{ ncId: string }> };
export async function POST(request: Request, context: Context) {
  try { return Response.json(await registrarAnaliseCausa(Number((await context.params).ncId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
