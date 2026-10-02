import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { avaliarNc } from "@/lib/nc/service";

type Context = { params: Promise<{ ncId: string }> };
export async function POST(request: Request, context: Context) {
  try { return Response.json(await avaliarNc(Number((await context.params).ncId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
