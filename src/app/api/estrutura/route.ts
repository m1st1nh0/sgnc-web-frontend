import { apiErrorResponse } from "@/lib/api/error";
import { listarEstrutura } from "@/lib/estrutura/service";

export async function GET() {
  try { return Response.json(await listarEstrutura()); } catch (error) { return apiErrorResponse(error); }
}
