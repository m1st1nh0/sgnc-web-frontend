import { apiErrorResponse } from "@/lib/api/error";
import { listarOpcoesNc } from "@/lib/usuarios/service";

export async function GET() {
  try {
    return Response.json(await listarOpcoesNc());
  } catch (error) {
    return apiErrorResponse(error);
  }
}
