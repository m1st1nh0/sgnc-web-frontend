import { apiErrorResponse } from "@/lib/api/error";
import { listarNcsDaPessoa } from "@/lib/nc/service";

type Context = { params: Promise<{ usuarioId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { usuarioId } = await context.params;
    const params = new URL(request.url).searchParams;
    return Response.json(await listarNcsDaPessoa(usuarioId, {
      pagina: Number(params.get("pagina") ?? 0),
      status: params.get("status"),
      inicio: params.get("inicio"),
      fim: params.get("fim"),
    }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
