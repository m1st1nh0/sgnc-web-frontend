import { expect, test } from "@playwright/test";
import { erroComprovante, assinaturaImagemValida, MAX_COMPROVANTE } from "../src/lib/nc/comprovante";

test("foto obrigatória: rejeita ausência, vazio, formato não suportado e excesso", () => {
  expect(erroComprovante(null)).toContain("Anexe");
  expect(erroComprovante({ type: "image/jpeg", size: 0 })).toContain("vazia");
  expect(erroComprovante({ type: "image/svg+xml", size: 100 })).toContain("JPG");
  expect(erroComprovante({ type: "image/jpeg", size: MAX_COMPROVANTE + 1 })).toContain("4 MB");
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    expect(erroComprovante({ type, size: MAX_COMPROVANTE })).toBeNull();
  }
});

test("MIME declarado não basta: confere bytes da imagem e rejeita disfarces", () => {
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    expect(assinaturaImagemValida(html, type)).toBe(false);
    expect(assinaturaImagemValida(new Uint8Array(), type)).toBe(false);
  }
  expect(assinaturaImagemValida(new Uint8Array([255, 216, 255, 224]), "image/jpeg")).toBe(true);
  expect(assinaturaImagemValida(new Uint8Array([137,80,78,71,13,10,26,10]), "image/png")).toBe(true);
  expect(assinaturaImagemValida(new TextEncoder().encode("RIFF0000WEBP"), "image/webp")).toBe(true);
  expect(assinaturaImagemValida(new Uint8Array([255,216,255]), "image/png")).toBe(false);
});
