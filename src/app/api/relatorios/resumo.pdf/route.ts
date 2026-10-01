import { apiErrorResponse } from "@/lib/api/error"; import { gerarPdfResumo } from "@/lib/reports/service"; import { downloadResponse } from "@/lib/reports/response";
export async function GET(request:Request){try{const file=await gerarPdfResumo(new URL(request.url).searchParams);return downloadResponse(file.bytes,file.filename,"application/pdf");}catch(error){return apiErrorResponse(error);}}
