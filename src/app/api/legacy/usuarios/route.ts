import { apiErrorResponse } from "@/lib/api/error";
import { criarUsuario, listarUsuarios } from "@/lib/usuarios/service";

export async function GET() {
  try {
    return Response.json(await listarUsuarios());
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await criarUsuario(await request.json()));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
