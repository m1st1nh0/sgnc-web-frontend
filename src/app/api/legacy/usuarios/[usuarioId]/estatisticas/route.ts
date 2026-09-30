import { apiErrorResponse } from "@/lib/api/error";
import { obterEstatisticasUsuario } from "@/lib/analytics/service";
type Context = { params: Promise<{ usuarioId: string }> };
export async function GET(_request: Request, context: Context) { try { return Response.json(await obterEstatisticasUsuario((await context.params).usuarioId)); } catch (error) { return apiErrorResponse(error); } }
