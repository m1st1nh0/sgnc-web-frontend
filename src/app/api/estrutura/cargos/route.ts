import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { salvarCargo } from "@/lib/estrutura/service";

export async function POST(request: Request) {
  try { return Response.json(await salvarCargo(null, await readJson(request)), { status: 201 }); }
  catch (error) { return apiErrorResponse(error); }
}
