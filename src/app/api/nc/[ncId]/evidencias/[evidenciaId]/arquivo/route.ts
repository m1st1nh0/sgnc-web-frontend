import { apiErrorResponse } from "@/lib/api/error";
import { urlDaEvidencia } from "@/lib/nc/evidence";

/**
 * Serve o arquivo de uma evidência, com a checagem de acesso da própria NC.
 * É por aqui que as imagens do relato aparecem: o texto guarda só o id, e o
 * endereço assinado (que expira) nunca entra no conteúdo.
 */
type Context = { params: Promise<{ ncId: string; evidenciaId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const url = await urlDaEvidencia(Number(params.ncId), Number(params.evidenciaId));
    return Response.redirect(url, 307);
  } catch (error) { return apiErrorResponse(error); }
}
