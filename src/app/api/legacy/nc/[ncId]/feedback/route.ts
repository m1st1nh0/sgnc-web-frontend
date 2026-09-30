import { apiErrorResponse } from "@/lib/api/error";
import { aplicarFeedback } from "@/lib/nc/service";

type Context = { params: Promise<{ ncId: string }> };
export async function POST(request: Request, context: Context) {
  try { return Response.json(await aplicarFeedback(Number((await context.params).ncId), await request.json())); }
  catch (error) { return apiErrorResponse(error); }
}
