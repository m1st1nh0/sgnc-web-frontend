import { apiErrorResponse } from "@/lib/api/error";
import { anexarEvidencia, listarEvidencias } from "@/lib/nc/evidence";

type Context = { params: Promise<{ ncId: string }> };
const idFrom = async (context: Context) => Number((await context.params).ncId);
export async function GET(_request: Request, context: Context) {
  try { return Response.json(await listarEvidencias(await idFrom(context))); }
  catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try { return Response.json(await anexarEvidencia(await idFrom(context), await request.formData())); }
  catch (error) { return apiErrorResponse(error); }
}
