import { readJson } from "@/lib/api/request";
import { apiErrorResponse, ApiError } from "@/lib/api/error";
import { atualizarCausaCatalogo, definirCausaAtiva, excluirCausaCatalogo } from "@/lib/nc/service";

type Context = { params: Promise<{ causaId: string }> };

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError("Causa inválida.", 422);
  return id;
}

export async function PUT(request: Request, context: Context) {
  try {
    const id = parseId((await context.params).causaId);
    return Response.json(await atualizarCausaCatalogo(id, await readJson(request)));
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const id = parseId((await context.params).causaId);
    const body = await readJson(request);
    if (typeof body.ativo !== "boolean") throw new ApiError("Informe se a causa deve ficar ativa.", 422);
    return Response.json(await definirCausaAtiva(id, body.ativo));
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const id = parseId((await context.params).causaId);
    return Response.json(await excluirCausaCatalogo(id));
  } catch (error) { return apiErrorResponse(error); }
}
