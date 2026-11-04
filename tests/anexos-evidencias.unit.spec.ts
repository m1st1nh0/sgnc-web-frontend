import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import {
  EXTENSOES_ANEXO, FORMATOS_ANEXO, MENSAGEM_FORMATO, TAMANHO_MAXIMO_ANEXO,
  chaveDoAnexo, ehImagemAnexo, extensaoDoArquivo, juntarAnexos, nomeDeImagemColada, problemaDoAnexo,
} from "../src/lib/nc/anexos.js";

type Falso = { name: string; size: number; lastModified?: number; type?: string };
const arquivo = (name: string, size = 1024, lastModified = 1, type = ""): Falso => ({ name, size, lastModified, type });

test("anexos: formato e tamanho inválidos geram mensagem clara", () => {
  expect(problemaDoAnexo(arquivo("print.png"))).toBeNull();
  expect(problemaDoAnexo(arquivo("planilha.XLSX"))).toBeNull();
  expect(problemaDoAnexo(arquivo("script.exe"))).toBe(MENSAGEM_FORMATO);
  expect(problemaDoAnexo(arquivo("sem-extensao"))).toBe(MENSAGEM_FORMATO);
  expect(problemaDoAnexo(arquivo("vazio.pdf", 0))).toContain("está vazio");
  expect(problemaDoAnexo(arquivo("grande.png", TAMANHO_MAXIMO_ANEXO + 1))).toContain("mais de 15 MB");
  expect(problemaDoAnexo(arquivo("limite.png", TAMANHO_MAXIMO_ANEXO))).toBeNull();
  expect(problemaDoAnexo(null)).toBe("Selecione um arquivo.");
  expect(MENSAGEM_FORMATO).toContain(".webp");
  expect(FORMATOS_ANEXO.split(",")).toHaveLength(EXTENSOES_ANEXO.length);
  expect(extensaoDoArquivo("foto.final.JPG")).toBe("jpg");
  expect(ehImagemAnexo("conversa.pdf")).toBe(false);
  expect(ehImagemAnexo("conversa.webp")).toBe(true);
});

test("anexos: arrastar e colar acrescentam à lista sem repetir o mesmo arquivo", () => {
  const print = arquivo("print.png", 2048, 10, "image/png");
  const pdf = arquivo("procedimento.pdf", 4096, 11);
  const primeiro = juntarAnexos([], [print]);
  expect(primeiro.arquivos).toHaveLength(1);
  expect(primeiro.aviso).toBe("");

  // Soltar o mesmo arquivo de novo não duplica e avisa o motivo.
  const repetido = juntarAnexos(primeiro.arquivos, [arquivo("print.png", 2048, 10, "image/png"), pdf]);
  expect(repetido.arquivos.map((item: Falso) => item.name)).toEqual(["print.png", "procedimento.pdf"]);
  expect(repetido.aceitos).toHaveLength(1);
  expect(repetido.aviso).toContain("já estava na lista");

  // Arquivo inválido no meio do lote: os válidos entram e o aviso explica o descartado.
  const misto = juntarAnexos(repetido.arquivos, [arquivo("virus.exe"), arquivo("extra.webp", 100, 12)]);
  expect(misto.arquivos).toHaveLength(3);
  expect(misto.aviso).toBe(MENSAGEM_FORMATO);
  expect(chaveDoAnexo(print)).toBe("print.png|2048|10");
});

test("anexos: imagem colada recebe nome próprio, mesmo vindo sem nome útil", () => {
  const agora = new Date("2026-11-03T18:45:09Z");
  expect(nomeDeImagemColada({ name: "image.png", type: "image/png" }, agora)).toBe("imagem-colada-20261103184509.png");
  expect(nomeDeImagemColada({ name: "", type: "image/jpeg" }, agora)).toBe("imagem-colada-20261103184509.jpg");
  // Duas colagens seguidas têm chaves diferentes (o lastModified é o do momento da colagem).
  const a = { name: nomeDeImagemColada({ name: "image.png" }, agora), size: 10, lastModified: 1 };
  const b = { name: nomeDeImagemColada({ name: "image.png" }, new Date("2026-11-03T18:45:10Z")), size: 10, lastModified: 2 };
  expect(juntarAnexos([a], [b]).arquivos).toHaveLength(2);
});

test("anexos: a API valida com as mesmas regras do formulário", () => {
  const evidence = readFileSync("src/lib/nc/evidence.ts", "utf8");
  expect(evidence).toContain('from "@/lib/nc/anexos"');
  expect(evidence).toContain("TAMANHO_MAXIMO_ANEXO");
  expect(evidence).toContain("MENSAGEM_FORMATO");
  // O envio continua pelo fluxo atual de armazenamento e permissões.
  expect(evidence).toContain("podeAnexarEvidencia");
  expect(evidence).toContain('admin.storage.from(BUCKET).upload');
});

test("anexos: a área aceita seleção, arrastar e colar, e é usável sem mouse", () => {
  const area = readFileSync("src/components/ui/AreaAnexos.jsx", "utf8");
  expect(area).toContain("onDrop={aoSoltar}");
  expect(area).toContain("onPaste={aoColar}");
  expect(area).toContain('type="file"');
  // Zona focável, com nome acessível e atalho de teclado para abrir o seletor.
  expect(area).toContain("tabIndex={disabled ? -1 : 0}");
  expect(area).toContain("aria-label={`${rotulo}: arraste arquivos");
  expect(area).toContain('evento.key !== "Enter" && evento.key !== " "');
  expect(area).toContain('role="status" aria-live="polite"');
  expect(area).toContain('role="alert"');
  for (const tela of [
    "src/features/nc/components/AbrirNcPage.jsx",
    "src/features/nc/components/DetalhesNcPage.jsx",
    "src/features/nc/components/PainelFeedback.jsx",
  ]) expect(readFileSync(tela, "utf8")).toContain("<AreaAnexos");
});

test("anexos: a área tem estilo de arrastar, foco visível e ajuste no celular", () => {
  const css = readFileSync("src/redesign.css", "utf8");
  expect(css).toMatch(/\.sg-area-anexos__zona\s*\{[^}]*border: 1px dashed/);
  expect(css).toContain(".sg-area-anexos__zona:focus-visible");
  expect(css).toContain(".sg-area-anexos__zona.is-arrastando");
  expect(css).toContain(".sg-area-anexos__miniatura");
  expect(css).toMatch(/@media \(max-width: 600px\) \{\s*\.sg-area-anexos__zona/);
  // A lista de arquivos continua usando o componente visual existente.
  expect(readFileSync("src/components/ui/AreaAnexos.jsx", "utf8")).toContain("sg-arquivos-selecionados");
});
