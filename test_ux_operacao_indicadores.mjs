import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const abertura = readFileSync("src/pages/AbrirNcPage.jsx", "utf8");
const estatisticas = readFileSync("src/pages/EstatisticasUsuarioPage.jsx", "utf8");
const insights = readFileSync("src/pages/InsightsPage.jsx", "utf8");
const home = readFileSync("src/pages/HomePage.jsx", "utf8");
const homeUx = readFileSync("src/services/homeUx.js", "utf8");
const api = readFileSync("src/services/api.js", "utf8");
const auth = readFileSync("src/context/AuthContext.jsx", "utf8");
const workflow = readFileSync(".github/workflows/frontend-checks.yml", "utf8");

assert.match(abertura, /Colaborador analisado/);
assert.match(abertura, /A busca apenas filtra os resultados/);
assert.doesNotMatch(abertura, /<option value="">Selecione/);
assert.match(abertura, /PreviewImagem/);
assert.match(abertura, /URL\.createObjectURL/);
assert.match(abertura, /Visualizar/);
assert.match(abertura, /await Promise\.all/);
assert.match(abertura, /Revise antes de abrir/);
assert.match(abertura, /Enviando .* evidência/);
assert.doesNotMatch(abertura, /iniciar anexos/);

assert.match(estatisticas, /Como esta página é calculada/);
assert.match(estatisticas, /Causas reincidentes/);
assert.doesNotMatch(estatisticas, /Causa ID:/);
assert.match(estatisticas, /NCs abertas ou invalidadas não entram/);

assert.match(insights, /O que estes números dizem agora/);
assert.match(insights, /Fotografia atual/);
assert.match(insights, /Histórico do período/);
assert.match(insights, /mesmo colaborador e a mesma causa/);
for (const id of ["operacao", "tempos", "reincidencia", "distribuicao", "disciplina"]) {
  assert.match(insights, new RegExp(`<section id="${id}" className=`));
}
assert.doesNotMatch(insights, /<section id="[^"]+">\s*<section/);

assert.match(home, /sg-home-destaque--/);
assert.match(home, /Acessos importantes para você/);
assert.match(homeUx, /Visão da Qualidade/);
assert.match(homeUx, /Sua equipe direta/);
assert.match(homeUx, /Seu próximo passo/);
assert.match(homeUx, /Seus indicadores pessoais separados/);

assert.match(api, /resposta\.status === 401/);
assert.match(api, /EVENTO_SESSAO_EXPIRADA/);
assert.match(auth, /addEventListener\(EVENTO_SESSAO_EXPIRADA/);
assert.equal((workflow.match(/^  push:/gm) || []).length, 1);
assert.equal((workflow.match(/^  pull_request:/gm) || []).length, 1);

console.log("UX OPERATION AND KPI EXPLANATION TESTS PASSED");
