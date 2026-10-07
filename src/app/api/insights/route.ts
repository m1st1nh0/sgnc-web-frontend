import { apiErrorResponse } from "@/lib/api/error";
import { obterInsights } from "@/lib/analytics/service";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(await obterInsights(params.get("inicio"), params.get("fim"), {
      status: params.get("status"),
      colaboradorId: params.get("colaborador_id"),
      setor: params.get("setor"),
    }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
