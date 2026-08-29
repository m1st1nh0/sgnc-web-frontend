import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  montarQueryRelatorio,
  nomeArquivoRelatorio,
} from "./src/services/relatoriosService.js";

const filtros = {
  inicio: "2026-01-01",
  fim: "2026-08-29",
  status: "aguardando_feedback",
  colaboradorId: "abc-123",
  setor: "Suporte N1",
};

const csvQuery = montarQueryRelatorio(filtros, { detalhado: true });
assert.match(csvQuery, /inicio=2026-01-01/);
assert.match(csvQuery, /fim=2026-08-29/);
assert.match(csvQuery, /status=aguardando_feedback/);
assert.match(csvQuery, /colaborador_id=abc-123/);
assert.match(csvQuery, /setor=Suporte\+N1/);

const pdfQuery = montarQueryRelatorio(filtros);
assert.match(pdfQuery, /inicio=2026-01-01/);
assert.match(pdfQuery, /fim=2026-08-29/);
assert.doesNotMatch(pdfQuery, /status=/);
assert.doesNotMatch(pdfQuery, /colaborador_id=/);
assert.doesNotMatch(pdfQuery, /setor=/);
assert.doesNotMatch(csvQuery, /token/i);

assert.equal(
  nomeArquivoRelatorio("pdf", filtros),
  "sgnc-resumo-2026-01-01-2026-08-29.pdf"
);
assert.equal(
  nomeArquivoRelatorio("csv", filtros),
  "sgnc-ncs-2026-01-01-2026-08-29.csv"
);

const api = readFileSync("src/services/api.js", "utf8");
const pagina = readFileSync("src/pages/RelatoriosPage.jsx", "utf8");
const app = readFileSync("src/App.jsx", "utf8");
const nav = readFileSync("src/components/BarraNavegacao.jsx", "utf8");

assert.match(api, /export async function baixarArquivoApi/);
assert.match(api, /Authorization/);
assert.match(api, /resposta\.blob\(\)/);
assert.doesNotMatch(api, /sgnc_token.*URLSearchParams/);

assert.match(pagina, /baixarPdfResumo/);
assert.match(pagina, /baixarCsvNcs/);
assert.match(pagina, /listarUsuarios/);
assert.match(pagina, /ocorrência canônica de 12 meses/);
assert.match(pagina, /somente sua equipe direta/);

assert.match(app, /path="\/relatorios"/);
assert.match(app, /RotaProtegida papeis=\{\["adm", "supervisor"\]\}/);
assert.match(nav, /to="\/relatorios"/);
assert.match(nav, /const ehGestao/);

console.log("PR07 REPORT UI TESTS PASSED");
