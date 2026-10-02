import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { concluirEtapa } from "@/lib/onboarding/service";
type Context = { params: Promise<{ chave: string }> };
export async function POST(request: Request, context: Context) { try { return Response.json(await concluirEtapa((await context.params).chave, await readJson(request))); } catch (error) { return apiErrorResponse(error); } }
