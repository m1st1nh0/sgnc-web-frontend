import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { concluirRelato } from "@/lib/nc/service";

/** Segundo passo da abertura: o relato com as imagens já enviadas como evidência. */
type Context = { params: Promise<{ ncId: string }> };
export async function PATCH(request: Request, context: Context) {
  try { return Response.json(await concluirRelato(Number((await context.params).ncId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
