import { test, expect } from "@playwright/test";

/**
 * Larguras de desktop, tablet e celular nas telas abertas sem sessão: nada
 * pode gerar rolagem horizontal nem erro de hidratação. As telas internas
 * (abas e área de anexos) exigem sessão e são validadas no Preview.
 */
const larguras = [
  { nome: "desktop", largura: 1440, altura: 900 },
  { nome: "tablet", largura: 820, altura: 1180 },
  { nome: "celular", largura: 390, altura: 844 },
];

for (const { nome, largura, altura } of larguras) {
  test(`sem rolagem horizontal nem erro de página em ${nome}`, async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (erro) => erros.push(erro.message));
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(erros).toEqual([]);
  });
}
