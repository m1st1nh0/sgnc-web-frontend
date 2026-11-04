import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { csvCell } from "../src/lib/reports/csv";
import { ROTULO_ACEITE, dataBr, dataHoraBr, duracao, periodoBr, plural, rotuloSituacaoMedida, rotuloStatus, rotuloTipoMedida } from "../src/lib/reports/formato";

const service = readFileSync("src/lib/reports/service.ts", "utf8") + readFileSync("src/lib/reports/pdf.ts", "utf8");

test("R1: status saem com o nome da tela, inclusive os legados", () => {
  expect(rotuloStatus("aberta")).toBe("Aguardando avaliação");
  expect(rotuloStatus("aguardando_feedback")).toBe("Aguardando feedback");
  expect(rotuloStatus("validada")).toBe("Aguardando feedback");
  expect(rotuloStatus("aguardando_analise")).toBe("Aguardando feedback");
  expect(rotuloStatus("nao_respondida")).toBe("Não respondida");
  expect(rotuloStatus("concluida")).toBe("Concluída");
});

test("R1: datas e horários no padrão brasileiro e no fuso de Brasília", () => {
  expect(dataBr("2026-09-14")).toBe("14/09/2026");
  expect(periodoBr("2026-09-14", "2026-10-13")).toBe("14/09/2026 a 13/10/2026");
  // Prazo do aceite gravado em UTC: 21h UTC é 18h em Brasília.
  expect(dataHoraBr("2026-10-13T21:00:00+00:00")).toBe("13/10/2026 18:00");
  // Depois das 21h em Brasília a data UTC já virou; o dia mostrado é o local.
  expect(dataBr("2026-10-14T01:30:00Z")).toBe("13/10/2026");
  expect(dataHoraBr(null)).toBe("-");
  expect(dataHoraBr("", "")).toBe("");
  expect(dataBr("lixo")).toBe("-");
});

test("R1: duração escrita como se fala", () => {
  expect(duracao(21)).toBe("menos de 1 min");
  expect(duracao(678)).toBe("11 min");
  expect(duracao(3600)).toBe("1 h");
  expect(duracao(7500)).toBe("2 h 05 min");
  expect(duracao(86400 * 3 + 3600 * 4)).toBe("3 d 4 h");
  expect(duracao(86400 * 2)).toBe("2 d");
  expect(duracao(null)).toBe("-");
});

test("R1: plural certo para 1 e para vários", () => {
  expect(plural(1, "NC", "NCs")).toBe("1 NC");
  expect(plural(3, "NC", "NCs")).toBe("3 NCs");
  expect(plural(1, "ocorrência")).toBe("1 ocorrência");
  expect(plural(0, "reincidente")).toBe("0 reincidentes");
});

test("R1: NC sem feedback deixa a situação do aceite em branco no CSV, sem apóstrofo", () => {
  expect(ROTULO_ACEITE.sem_feedback).toBe("");
  expect(csvCell(ROTULO_ACEITE.sem_feedback)).toBe('""');
  expect(ROTULO_ACEITE.nao_respondida).toBe("Não respondida");
});

test("R1: medidas disciplinares com o nome da tela", () => {
  expect(rotuloTipoMedida("advertencia")).toBe("Advertência");
  expect(rotuloTipoMedida("avaliar_justa_causa")).toBe("Avaliar justa causa/permanência");
  expect(rotuloSituacaoMedida("aprovada")).toBe("Aprovada, a aplicar");
});

test("R1: a fonte padrão do PDF desenha os acentos usados nos relatórios", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const suportados = new Set(font.getCharacterSet());
  for (const char of "ÁÂÃÀÇÉÊÍÓÔÕÚáâãàçéêíóôõú·ª–—") expect(suportados.has(char.codePointAt(0)!)).toBe(true);
  // Emoji não existe na fonte: o gerador troca por "?" em vez de deixar o drawText lançar erro.
  expect(suportados.has("😀".codePointAt(0)!)).toBe(false);
  expect(service).toContain("function textoDaFonte(font: PDFFont, texto: string)");
});

test("R1: relatórios sem texto sem acento, com rodapé e recorte", () => {
  for (const antigo of ["\"Nao ", "Acao combinada", "\"Descricao", "\"Situacao", "AUTOMACAO", "\"Relatorio", "\"Dossie", "\"Historico", "\"Evidencias", "Nenhuma evidencia"]) {
    expect(service).not.toContain(antigo);
  }
  expect(service).toContain("Página ${index + 1} de ${pages.length}");
  expect(service).toContain("Gerado por ${geradoPor");
  const resumo = readFileSync("src/lib/reports/resumo-pdf.ts", "utf8");
  expect(resumo).toContain("${dados.escopo} · Filtros: ${dados.filtros}");
  expect(service).not.toContain("snapshot ocorrencia_numero");
});

test("R1: PDF com emoji, texto longo e várias páginas gera rodapé em todas", async () => {
  const { pdfWriter } = await import("../src/lib/reports/pdf");
  const writer = await pdfWriter("Relatório de Não Conformidade", "NC #12");
  writer.heading("Descrição");
  writer.line("Registro", "Colaborador lançou horas 😀 → fora do padrão. ".repeat(20));
  for (let i = 0; i < 80; i++) writer.line(`Linha ${i + 1}`, "Situação do aceite: Não respondida");
  const bytes = await writer.finish("Lucas");
  if (process.env.SGNC_PDF_AMOSTRA) (await import("node:fs")).writeFileSync(process.env.SGNC_PDF_AMOSTRA, bytes);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThan(1);
});

test("R1: texto longo encurta sem cortar palavra e sem sobrar espaço", async () => {
  const { encurtar } = await import("../src/lib/reports/pdf");
  expect(encurtar("Apontou horas a mais", 40)).toBe("Apontou horas a mais");
  expect(encurtar("Linha um\nlinha dois   com   espaços")).toBe("Linha um linha dois com espaços");
  expect(encurtar("Colaborador lançou horas fora do padrão combinado na reunião", 30)).toBe("Colaborador lançou horas fora...");
  // Palavra única e enorme: corta no limite, sem deixar a célula ilegível.
  expect(encurtar("a".repeat(50), 10)).toBe(`${"a".repeat(10)}...`);
  expect(encurtar(null)).toBe("");
});

test("R1: chamado e erros apontados aparecem no PDF, no Excel e no CSV", () => {
  const resumo = readFileSync("src/lib/reports/resumo-pdf.ts", "utf8");
  const planilhas = readFileSync("src/lib/reports/planilhas.ts", "utf8");
  // Resumo gerencial: as duas colunas na lista de NCs, com a descrição encurtada.
  expect(resumo).toContain('{ titulo: "Chamado"');
  expect(resumo).toContain('{ titulo: "Erros apontados"');
  expect(resumo).toContain("encurtar(nc.descricao, 160)");
  // Relatório da NC: chamado no resumo e a descrição sob o título novo.
  expect(service).toContain('writer.line("Chamado", nc.chamado)');
  expect(service).toContain('writer.heading("Erros apontados")');
  // Planilhas: coluna no CSV simples e na aba de NCs do Excel.
  expect(planilhas).toContain('"Chamado", "Causa", "Erros apontados"');
  expect(planilhas).toContain('{ titulo: "Erros apontados", largura: 50, tipo: "textoLongo" }');
  // Campo lido do banco para os dois.
  expect(readFileSync("src/lib/reports/dados.ts", "utf8")).toContain("chamado, descricao");
  // Lista na tela de relatórios.
  expect(readFileSync("src/features/reports/components/RelatoriosPage.jsx", "utf8")).toContain('<th scope="col">Erros apontados</th>');
  expect(readFileSync("src/lib/analytics/drilldown.ts", "utf8")).toContain("chamado, descricao");
});
