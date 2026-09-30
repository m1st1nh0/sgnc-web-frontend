import { apiErrorResponse } from "@/lib/api/error"; import { gerarCsvNcs } from "@/lib/reports/service"; import { downloadResponse } from "@/lib/reports/response";
export async function GET(request:Request){try{const file=await gerarCsvNcs(new URL(request.url).searchParams);return downloadResponse(file.bytes,file.filename,"text/csv; charset=utf-8");}catch(error){return apiErrorResponse(error);}}
