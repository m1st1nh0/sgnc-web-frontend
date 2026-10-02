import { apiErrorResponse } from "@/lib/api/error";
import { alterarAtivo } from "@/lib/usuarios/service";

type Context = { params: Promise<{ usuarioId: string }> };

export async function PATCH(_request: Request, context: Context) {
  try {
    const { usuarioId } = await context.params;
    return Response.json(await alterarAtivo(usuarioId, false));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
