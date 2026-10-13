import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { expect, test } from "@playwright/test";

import { CABECALHO_CSV_SIMPLES, montarAbas, montarCsvSimples, type DadosPlanilha } from "../src/lib/reports/planilhas";
import { gerarXlsx, letraDaColuna, serialExcel } from "../src/lib/reports/xlsx";

const agora = new Date("2026-10-13T17:30:00Z");
const ncs = [
  { id: 5, data: "2026-10-10", status: "concluida", colaborador_id: "u1", colaborador: "teste funcionário", setor: "Suporte", criticidade: "Média", chamado: "1234", descricao: "Apontamento de horas incorreto", criado_em: "2026-10-10T14:10:15Z", validado_em: "2026-10-10T14:10:30Z", feedback_aplicado_em: "2026-10-10T14:21:48Z", aceito_em: "2026-10-10T14:25:44Z", aceito_fora_prazo: false },
  { id: 12, data: "2026-10-10", status: "aguardando_feedback", colaborador_id: "u1", colaborador: "teste funcionário", setor: "Suporte", criticidade: "Baixa", chamado: "=1+1", descricao: "Linha com <tag> & \"aspas\"", criado_em: "2026-10-10T14:54:29Z", validado_em: "2026-10-10T14:54:34Z" },
  { id: 11, data: "2026-10-10", status: "aguardando_aceite", colaborador_id: "u1", colaborador: "teste funcionário", setor: "Suporte", criticidade: "Baixa", chamado: "1232", descricao: "Teste", criado_em: "2026-10-10T14:53:17Z", validado_em: "2026-10-10T14:53:27Z", feedback_aplicado_em: "2026-10-10T14:53:48Z" },
];
const causa = (id: number, n: number): [number, Record<string, unknown>[]] => [id, [{ causa_id: 7, descricao: "Apontamento de horas incoerente", ocorrencia_numero: n }]];
const dados: DadosPlanilha = {
  ncs,
  causas: new Map([causa(5, 1), causa(12, 4), causa(11, 3)]),
  feedbacks: new Map([
    [5, { causa_raiz: "Erro operacional", acao_combinada: "Explicar a contabilização", responsavel_acao_nome: "teste qulidade", prazo_acao: "2026-10-14", combinado: "Seguir o padrão", prazo_aceite: "2026-10-13T21:00:00+00:00" }],
    [11, { causa_raiz: "Teste", acao_combinada: "Teste", responsavel_acao_nome: "Lucas", prazo_acao: "2026-10-10", combinado: "Teste", prazo_aceite: "2026-10-13T21:00:00+00:00" }],
  ]),
  medidas: [{ nc_id: 12, causa_id: 7, tipo: "advertencia", status: "sugerida", ocorrencia_gatilho: 4 }],
  lideres: new Map([["u1", "Supervisor Suporte"]]),
  historico: [{ nc_id: 5, criado_em: "2026-10-10T14:10:15Z", status_anterior: null, status_novo: "aberta", autor_nome: "Lucas", observacao: null }],
  insights: { kpis: { total_ncs: 3, taxa_aceite_no_prazo: 1, aceites_no_prazo: 1 }, tempos: { ciclo_total: { amostras: 1, mediana_segundos: 929 } } },
  leiaMe: { geradoPor: "Lucas", geradoEm: "13/10/2026 14:30", periodo: "14/09/2026 a 13/10/2026", escopo: "Toda a empresa", filtros: "nenhum" },
  origem: "https://sgnc.example/",
  agora,
};

test("R3: CSV simples tem 15 colunas, ordem de ação, líder, medida e link", () => {
  const linhas = montarCsvSimples(dados).replace(/^﻿/, "").split("\r\n");
  expect(CABECALHO_CSV_SIMPLES).toHaveLength(15);
  expect(linhas[0]).toBe(CABECALHO_CSV_SIMPLES.map((titulo) => `"${titulo}"`).join(";"));
  expect(linhas.slice(1).map((linha) => linha.split(";")[0])).toEqual(['"11"', '"12"', '"5"']);
  expect(linhas[1]).toBe('"11";"10/10/2026";"Aguardando aceite";"3";"teste funcionário";"Suporte";"Supervisor Suporte";"Baixa";"1232";"Apontamento de horas incoerente";"3ª";"13/10/2026 18:00";"Aguardando aceite";"";"https://sgnc.example/nc/11"');
  expect(linhas[2]).toContain('"\'=1+1"');
  expect(linhas[2]).toContain('"Advertência (sugerida)"');
  expect(linhas[3]).toContain('"Aceito no prazo"');
});

test("R3: Excel tem as seis abas e valores tipados", () => {
  const abas = montarAbas(dados);
  expect(abas.map((aba) => aba.nome)).toEqual(["NCs", "Causas", "Feedback", "Linha do tempo", "Indicadores", "Leia-me"]);
  const [nc] = abas[0].linhas;
  const coluna = (titulo: string) => abas[0].colunas.findIndex((item) => item.titulo === titulo);
  expect(nc[0]).toBe(11);
  expect(nc[coluna("Líder direto")]).toBe("Supervisor Suporte");
  expect(nc[coluna("Validação até feedback")]).toBe(21);
  expect(abas[1].linhas.find((linha) => linha[0] === 12)).toEqual([12, "2026-10-10", "teste funcionário", "Suporte", "Apontamento de horas incoerente", 4, "Sim", "Advertência", "Sugerida"]);
  expect(abas[2].linhas.map((linha) => linha[0])).toEqual([11, 5]);
  expect(abas[3].linhas[0]).toEqual([5, "2026-10-10T14:10:15Z", "", "Aguardando avaliação", "Lucas", null]);
});

test("R3: datas do Excel no horário de Brasília e colunas além de Z", () => {
  // 13/10/2026 18:00 em Brasília.
  expect(serialExcel("2026-10-13T21:00:00+00:00")).toBeCloseTo(46308.75, 6);
  expect(serialExcel("2026-10-13")).toBe(46308);
  expect(serialExcel("lixo")).toBeNull();
  expect([letraDaColuna(0), letraDaColuna(25), letraDaColuna(26), letraDaColuna(27), letraDaColuna(701), letraDaColuna(702)]).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
});

/** Lê as entradas do zip pelo diretório central, para conferir o pacote sem dependência. */
function entradasDoZip(bytes: Uint8Array) {
  const buf = Buffer.from(bytes);
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = buf.readUInt16LE(fim + 10);
  let pos = buf.readUInt32LE(fim + 16);
  const arquivos = new Map<string, string>();
  for (let i = 0; i < total; i++) {
    const tamanhoNome = buf.readUInt16LE(pos + 28), comprimido = buf.readUInt32LE(pos + 20), local = buf.readUInt32LE(pos + 42);
    const nome = buf.subarray(pos + 46, pos + 46 + tamanhoNome).toString("utf8");
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    arquivos.set(nome, inflateRawSync(buf.subarray(inicio, inicio + comprimido)).toString("utf8"));
    pos += 46 + tamanhoNome;
  }
  return arquivos;
}

test("R3: pacote .xlsx válido, com cabeçalho congelado, autofiltro e texto escapado", () => {
  const bytes = gerarXlsx(montarAbas(dados));
  if (process.env.SGNC_XLSX_AMOSTRA) writeFileSync(process.env.SGNC_XLSX_AMOSTRA, bytes);
  const arquivos = entradasDoZip(bytes);
  expect([...arquivos.keys()]).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet6.xml"]));
  const nc = arquivos.get("xl/worksheets/sheet1.xml")!;
  expect(nc).toContain('state="frozen"');
  expect(nc).toContain('<autoFilter ref="A1:X4"/>');
  expect(nc).toContain("Linha com &lt;tag&gt; &amp; &quot;aspas&quot;");
  // Texto que parece fórmula vai como inlineStr, nunca como <f>.
  expect(nc).not.toContain("<f>");
  expect(arquivos.get("xl/workbook.xml")).toContain('name="Linha do tempo"');
});

test("R3: rotas e botão da tela", () => {
  const pagina = readFileSync("src/features/reports/components/RelatoriosPage.jsx", "utf8");
  expect(pagina).toContain('onClick={() => gerar("xlsx")}');
  expect(pagina).toContain(">Baixar Excel</Botao>");
  expect(pagina).toContain(">CSV simples</Botao>");
  expect(readFileSync("src/app/api/relatorios/ncs.xlsx/route.ts", "utf8")).toContain("gerarXlsxNcs(url.searchParams,url.origin)");
});

test("R3: colunas lidas de nc_feedbacks existem na migração (o dossiê e os relatórios dependem disso)", () => {
  const dadosTs = readFileSync("src/lib/reports/dados.ts", "utf8");
  const migracao = readFileSync("supabase/migrations/20261010121000_feedback_estruturado_aceite_prazo.sql", "utf8");
  const tabela = migracao.slice(migracao.indexOf("CREATE TABLE public.nc_feedbacks"), migracao.indexOf(");", migracao.indexOf("CREATE TABLE public.nc_feedbacks")));
  const select = dadosTs.match(/from\("nc_feedbacks"\)\s*\.select\("([^"]+)"\)/)?.[1] ?? "";
  const colunas = select.split(",").map((coluna) => coluna.trim()).filter(Boolean);
  expect(colunas.length).toBeGreaterThan(5);
  for (const coluna of colunas) expect(tabela, `coluna ${coluna}`).toMatch(new RegExp(`\\n\\s+${coluna}\\s`));
});
