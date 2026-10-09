import { readJson } from "@/lib/api/request";
import { apiErrorResponse, ApiError } from "@/lib/api/error";
import { requireApiUser } from "@/lib/auth/api";
import { decidirSolicitacaoCausa } from "@/lib/nc/service";
import { ehQualidade } from "@/lib/auth/papeis";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!ehQualidade(user.papel)) throw new ApiError("Apenas a Qualidade pode decidir solicitações.", 403);
    const body = await readJson(request);
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError("Solicitação inválida.", 422);
    return Response.json(await decidirSolicitacaoCausa(id, body));
  } catch (error) { return apiErrorResponse(error); }
}
