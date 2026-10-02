import { readJson } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/error";
import { trocarSenha } from "@/lib/usuarios/service";

export async function POST(request: Request) {
  try {
    return Response.json(await trocarSenha(await readJson(request)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
