import { apiErrorResponse } from "@/lib/api/error";
import { listarCausas } from "@/lib/nc/service";

export async function GET() {
  try { return Response.json(await listarCausas()); } catch (error) { return apiErrorResponse(error); }
}
