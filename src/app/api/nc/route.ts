import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { criarNc, listarNcs } from "@/lib/nc/service";

export async function GET() {
  try { return Response.json(await listarNcs()); } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try { return Response.json(await criarNc(await readJson(request))); } catch (error) { return apiErrorResponse(error); }
}
