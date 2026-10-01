import { ApiError, apiErrorResponse } from '@/lib/api/error';
import { gerarPdfNc } from '@/lib/reports/service';
import { downloadResponse } from '@/lib/reports/response';
type Context = { params: Promise<{ ncId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { ncId } = await context.params;
    if (!/^[1-9]\d*\.pdf$/.test(ncId)) throw new ApiError('Rota não encontrada.', 404);
    const id = Number(ncId.slice(0, -4));
    if (!Number.isSafeInteger(id)) throw new ApiError('NC inválida.', 422);
    const file = await gerarPdfNc(id);
    return downloadResponse(file.bytes, file.filename, 'application/pdf');
  } catch (error) { return apiErrorResponse(error); }
}
