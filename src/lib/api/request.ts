import { ApiError } from "./error";
export async function readJson(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError("JSON inválido.", 422); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Envie um objeto JSON.", 422);
  return body as Record<string, unknown>;
}
