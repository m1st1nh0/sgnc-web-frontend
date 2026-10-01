import { apiErrorResponse } from "@/lib/api/error";
import { listarMinhasNcs } from "@/lib/nc/service";

export async function GET() {
  try {
    return Response.json(await listarMinhasNcs());
  } catch (error) {
    return apiErrorResponse(error);
  }
}
