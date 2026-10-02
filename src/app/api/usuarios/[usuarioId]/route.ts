import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { editarUsuario } from "@/lib/usuarios/service";

type Context = { params: Promise<{ usuarioId: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { usuarioId } = await context.params;
    return Response.json(await editarUsuario(usuarioId, await readJson(request)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
