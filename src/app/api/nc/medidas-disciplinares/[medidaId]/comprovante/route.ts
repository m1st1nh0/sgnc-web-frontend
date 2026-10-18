import { apiErrorResponse } from "@/lib/api/error";
import { obterComprovanteMedida } from "@/lib/nc/medidas";

type Context = { params: Promise<{ medidaId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const url = await obterComprovanteMedida(Number((await context.params).medidaId), new URL(request.url).searchParams.get("download") === "1");
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return apiErrorResponse(error); }
}
