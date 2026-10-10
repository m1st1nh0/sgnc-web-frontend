import { apiErrorResponse } from "@/lib/api/error";
import { listarMedidas } from "@/lib/nc/medidas";

/** Medidas para a Qualidade: `?situacao=historico` para as já decididas; padrão, as pendentes. */
export async function GET(request: Request) {
  try { return Response.json(await listarMedidas(new URL(request.url).searchParams.get("situacao"))); }
  catch (error) { return apiErrorResponse(error); }
}
