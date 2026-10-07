import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  montarQueryRelatorio,
  nomeArquivoRelatorio,
} from "./src/features/reports/client/relatoriosQuery.js";

const filtros = {
  inicio: "2026-01-01",
  fim: "2026-08-29",
  status: "aguardando_feedback",
  colaboradorId: "abc-123",
  setor: "Suporte N1",
};

const csvQuery = montarQueryRelatorio(filtros);
assert.match(csvQuery, /inicio=2026-01-01/);
assert.match(csvQuery, /fim=2026-08-29/);
assert.match(csvQuery, /status=aguardando_feedback/);
assert.match(csvQuery, /colaborador_id=abc-123/);
assert.match(csvQuery, /setor=Suporte\+N1/);

const pdfQuery = montarQueryRelatorio(filtros);
assert.match(pdfQuery, /inicio=2026-01-01/);
assert.match(pdfQuery, /fim=2026-08-29/);
assert.match(pdfQuery, /status=aguardando_feedback/);
assert.match(pdfQuery, /colaborador_id=abc-123/);
assert.match(pdfQuery, /setor=Suporte\+N1/);
assert.doesNotMatch(csvQuery, /token/i);

assert.equal(
  nomeArquivoRelatorio("pdf", filtros),
  "sgnc-resumo-2026-01-01-2026-08-29.pdf"
);
assert.equal(
  nomeArquivoRelatorio("csv", filtros),
  "sgnc-ncs-2026-01-01-2026-08-29.csv"
);

const api = readFileSync("src/lib/api/client/api.js", "utf8");
const config = readFileSync("src/lib/api/client/config.js", "utf8");
const service = readFileSync("src/features/reports/client/relatoriosService.js", "utf8");
const pagina = readFileSync("src/features/reports/components/RelatoriosPage.jsx", "utf8");
const app = readFileSync("src/app/(app)/relatorios/page.tsx", "utf8");
const nav = readFileSync("src/components/navigation/BarraNavegacao.jsx", "utf8");
const reportPage = readFileSync("src/features/reports/components/RelatoriosPage.jsx", "utf8");
const barChart = readFileSync("src/components/graficos/GraficoBarrasHorizontais.jsx", "utf8");

assert.match(api, /export async function baixarArquivoApi/);
assert.match(api, /credentials: "same-origin"/);
assert.match(config, /API_BASE_URL = "\/api"/);
assert.match(api, /resposta\.blob\(\)/);
assert.doesNotMatch(api, /sgnc_token.*URLSearchParams/);
assert.match(service, /\/relatorios\/ncs\.csv/);
assert.match(service, /\/relatorios\/resumo\.pdf/);
assert.match(service, /relatoriosQuery\.js/);
assert.match(service, /\/relatorios\/usuarios\/.*dossie\.pdf/);
assert.match(service, /\/relatorios\/nc\/.*\.pdf/);

assert.match(pagina, /baixarPdfResumo/);
assert.match(pagina, /baixarCsvNcs/);
assert.match(pagina, /listarEquipe/);
assert.match(pagina, /Visão na tela/);
assert.match(pagina, /Últimos 30 dias/);
assert.match(pagina, /NCs do período/);
assert.match(pagina, /ModalNcsIndicador/);
assert.match(reportPage, /CORES_STATUS/);
assert.match(reportPage, /PALETA_CATEGORIAS/);
assert.match(reportPage, /<BadgeStatus status=\{nc\.status\}/);
assert.match(barChart, /corChave/);

assert.match(app, /RelatoriosPage/);
assert.match(app, /requireRole\(\["adm", "supervisor"\]\)/);
assert.match(nav, /href="\/relatorios"/);
assert.match(nav, /const ehGestao/);

console.log("PR07 REPORT UI TESTS PASSED");
