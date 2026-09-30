import { apiErrorResponse } from "@/lib/api/error";
import { excluirEvidencia } from "@/lib/nc/evidence";

type Context = { params: Promise<{ ncId: string; evidenciaId: string }> };
export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    return Response.json(await excluirEvidencia(Number(params.ncId), Number(params.evidenciaId)));
  } catch (error) { return apiErrorResponse(error); }
}
