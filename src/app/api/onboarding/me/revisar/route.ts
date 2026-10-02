import { apiErrorResponse } from "@/lib/api/error";
import { obterOnboarding } from "@/lib/onboarding/service";
export async function POST() { try { return Response.json(await obterOnboarding(true)); } catch (error) { return apiErrorResponse(error); } }
