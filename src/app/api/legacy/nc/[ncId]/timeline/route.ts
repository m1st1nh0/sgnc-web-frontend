import { apiErrorResponse } from "@/lib/api/error";
import { obterTimeline } from "@/lib/nc/service";

type Context = { params: Promise<{ ncId: string }> };
export async function GET(_request: Request, context: Context) {
  try { return Response.json(await obterTimeline(Number((await context.params).ncId))); }
  catch (error) { return apiErrorResponse(error); }
}
