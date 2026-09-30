import { apiErrorResponse } from "@/lib/api/error";
import { registrarMedidaDisciplinar } from "@/lib/nc/service";

export async function POST(request: Request) {
  try { return Response.json(await registrarMedidaDisciplinar(await request.json()), { status: 201 }); }
  catch (error) { return apiErrorResponse(error); }
}
