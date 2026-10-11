import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { salvarDepartamento } from "@/lib/estrutura/service";

export async function POST(request: Request) {
  try { return Response.json(await salvarDepartamento(null, await readJson(request)), { status: 201 }); }
  catch (error) { return apiErrorResponse(error); }
}
