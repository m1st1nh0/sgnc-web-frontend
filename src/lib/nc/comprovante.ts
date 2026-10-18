/** Limite abaixo do teto de corpo da hospedagem, incluindo o multipart. */
export const MAX_COMPROVANTE = 4 * 1024 * 1024;
export const TIPOS_COMPROVANTE = ["image/jpeg", "image/png", "image/webp"];

export function erroComprovante(file: { size: number; type: string } | null) {
  if (!file) return "Anexe a foto da medida disciplinar assinada.";
  if (!TIPOS_COMPROVANTE.includes(file.type)) return "Selecione uma foto JPG, PNG ou WebP.";
  if (!file.size) return "A foto está vazia. Selecione outro arquivo.";
  if (file.size > MAX_COMPROVANTE) return "A foto deve ter no máximo 4 MB.";
  return null;
}

export function assinaturaImagemValida(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}
