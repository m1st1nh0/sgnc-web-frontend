import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { salvarCargo } from "@/lib/estrutura/service";

type Context = { params: Promise<{ cargoId: string }> };
export async function PATCH(request: Request, context: Context) {
  try { return Response.json(await salvarCargo((await context.params).cargoId, await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
