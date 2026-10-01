import { apiErrorResponse } from "@/lib/api/error";
import { listarNcsDoIndicador } from "@/lib/analytics/drilldown";

export async function GET(request: Request) {
  try {
    return Response.json(await listarNcsDoIndicador(new URL(request.url).searchParams));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
