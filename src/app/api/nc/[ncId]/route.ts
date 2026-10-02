import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { buscarNc, editarNc, excluirNc } from "@/lib/nc/service";

type Context = { params: Promise<{ ncId: string }> };
const idFrom = async (context: Context) => Number((await context.params).ncId);

export async function GET(_request: Request, context: Context) {
  try { return Response.json(await buscarNc(await idFrom(context))); } catch (error) { return apiErrorResponse(error); }
}
export async function PUT(request: Request, context: Context) {
  try { return Response.json(await editarNc(await idFrom(context), await readJson(request))); } catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(_request: Request, context: Context) {
  try { return Response.json(await excluirNc(await idFrom(context))); } catch (error) { return apiErrorResponse(error); }
}
