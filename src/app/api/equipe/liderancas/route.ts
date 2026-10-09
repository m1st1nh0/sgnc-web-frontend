import { apiErrorResponse } from "@/lib/api/error";
import { listarLiderancas } from "@/lib/equipes/service";

export async function GET() {
  try { return Response.json(await listarLiderancas()); } catch (error) { return apiErrorResponse(error); }
}
