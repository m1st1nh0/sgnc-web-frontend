import { apiErrorResponse } from "@/lib/api/error";
import { atualizarOnboarding } from "@/lib/onboarding/service";
export async function POST() { try { return Response.json(await atualizarOnboarding("dispensar")); } catch (error) { return apiErrorResponse(error); } }
