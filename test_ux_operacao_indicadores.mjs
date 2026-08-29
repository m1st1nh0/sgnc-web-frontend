import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const abertura = readFileSync("src/pages/AbrirNcPage.jsx", "utf8");
const estatisticas = readFileSync("src/pages/EstatisticasUsuarioPage.jsx", "utf8");
const insights = readFileSync("src/pages/InsightsPage.jsx", "utf8");

assert.match(abertura, /Buscar colaborador/);
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

console.log("UX OPERATION AND KPI EXPLANATION TESTS PASSED");
