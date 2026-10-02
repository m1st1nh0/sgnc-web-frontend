import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { criarCausaCatalogo, listarCausasGestao } from "@/lib/nc/service";

export async function GET() {
  try { return Response.json(await listarCausasGestao()); }
  catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try { return Response.json(await criarCausaCatalogo(await readJson(request)), { status: 201 }); }
  catch (error) { return apiErrorResponse(error); }
}
