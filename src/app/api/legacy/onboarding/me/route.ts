import { apiErrorResponse } from "@/lib/api/error";
import { obterOnboarding } from "@/lib/onboarding/service";
export async function GET() { try { return Response.json(await obterOnboarding()); } catch (error) { return apiErrorResponse(error); } }
