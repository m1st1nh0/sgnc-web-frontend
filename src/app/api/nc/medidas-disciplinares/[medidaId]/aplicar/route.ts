import { ApiError, apiErrorResponse } from "@/lib/api/error";
import { requireApiUser } from "@/lib/auth/api";
import { aplicarMedida } from "@/lib/nc/medidas";

type Context = { params: Promise<{ medidaId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    await requireApiUser();
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      throw new ApiError("Anexe a foto da medida disciplinar assinada.", 422, "arquivo");
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { throw new ApiError("Não foi possível ler a foto enviada.", 422, "arquivo"); }
    return Response.json(await aplicarMedida(Number((await context.params).medidaId), form));
  } catch (error) { return apiErrorResponse(error); }
}
