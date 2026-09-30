import { apiErrorResponse } from "@/lib/api/error";
import { trocarSenha } from "@/lib/usuarios/service";

export async function POST(request: Request) {
  try {
    return Response.json(await trocarSenha(await request.json()));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
