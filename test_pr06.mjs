import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  descricaoTempo,
  formatarDuracao,
  formatarMesInsights,
  prepararAging,
  prepararBacklogStatus,
  prepararCausas,
  prepararReincidenciaCausa,
  rotuloEscopo,
} from "./src/services/insightsUx.js";

assert.equal(formatarMesInsights("2026-08"), "ago/26");
assert.equal(formatarDuracao(45), "45s");
assert.equal(formatarDuracao(3600), "1h");
assert.equal(formatarDuracao(5400), "1h 30min");
assert.equal(formatarDuracao(90000), "1d 1h");
assert.equal(formatarDuracao(null), "—");

assert.equal(
  descricaoTempo({ amostras: 2, media_segundos: 7200 }),
  "Média 2h · 2 amostras"
);
assert.equal(descricaoTempo({ amostras: 0 }), "Sem amostras no período");

assert.equal(
  rotuloEscopo({ tipo: "equipe_direta", quantidade_colaboradores: 1 }),
  "Equipe direta · 1 colaborador"
);
assert.equal(
  rotuloEscopo({ tipo: "equipe_direta", quantidade_colaboradores: 3 }),
  "Equipe direta · 3 colaboradores"
);
assert.equal(rotuloEscopo({ tipo: "global" }), "Visão global da organização");

const aging = prepararAging({
  faixas: [
    { faixa: "8+d", quantidade: 2 },
    { faixa: "0-1d", quantidade: 4 },
  ],
});
assert.deepEqual(aging, [
  { faixa: "0-1d", quantidade: 4 },
  { faixa: "2-3d", quantidade: 0 },
  { faixa: "4-7d", quantidade: 0 },
  { faixa: "8+d", quantidade: 2 },
]);

assert.deepEqual(
  prepararBacklogStatus({
    abertas_atuais: 3,
    aguardando_feedback_atual: 2,
    aguardando_aceite_atual: 1,
  }),
  [
    { status: "Aguardando avaliação", quantidade: 3 },
    { status: "Aguardando feedback", quantidade: 2 },
    { status: "Aguardando aceite", quantidade: 1 },
  ]
);

const causas = prepararCausas([
  { causa: "Cadastro", total: 5, total_reincidentes: 2 },
]);
assert.equal(causas[0].nao_reincidentes, 3);

const reincidencia = prepararReincidenciaCausa([
  {
    causa: "Cadastro",
    ocorrencias: 6,
    reincidencias_12m: 2,
    reincidiu_apos_conclusao: 99,
  },
]);
assert.equal(reincidencia[0].demais_ocorrencias, 4);
assert.equal(reincidencia[0].reincidencias_12m, 2);

const pagina = readFileSync("src/pages/InsightsPage.jsx", "utf8");
assert.match(pagina, /versao_contrato !== "insights-v2"/);
assert.match(pagina, /backlog_ativo_atual/);
assert.match(pagina, /mediana_segundos/);
assert.match(pagina, /reincidencias_12m/);
assert.match(pagina, /type="date"/);
assert.match(pagina, /Aplicar período/);
assert.match(pagina, /Aging do backlog/);
assert.match(pagina, /Velocidade do fluxo/);
assert.doesNotMatch(pagina, /reincidiu_apos_conclusao/);

console.log("PR06 INSIGHTS V2 PRESENTATION TESTS PASSED");
