import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const abertura = readFileSync("src/pages/AbrirNcPage.jsx", "utf8");
const estatisticas = readFileSync("src/pages/EstatisticasUsuarioPage.jsx", "utf8");
const usuarios = readFileSync("src/pages/UsuariosPage.jsx", "utf8");
const detalhes = readFileSync("src/pages/DetalhesNcPage.jsx", "utf8");
const navegacao = readFileSync("src/components/BarraNavegacao.jsx", "utf8");
const estilos = readFileSync("src/redesign.css", "utf8");
const app = readFileSync("src/App.jsx", "utf8");
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
assert.match(abertura, /type="file"\s+multiple\s+accept=\{FORMATOS_EVIDENCIA\}/);
assert.match(abertura, /\[\.\.\.atuais, \.\.\.novosArquivos\]/);
assert.match(abertura, /Evidências<\/dt><dd>\{arquivosEvidencias\.length\}/);
assert.match(abertura, /Revise antes de abrir/);
assert.match(abertura, /Enviando .* evidência/);
assert.doesNotMatch(abertura, /iniciar anexos/);

assert.match(estatisticas, /Como esta página é calculada/);
assert.match(estatisticas, /Causas reincidentes/);
assert.doesNotMatch(estatisticas, /Causa ID:/);
assert.match(estatisticas, /NCs abertas ou invalidadas não entram/);
assert.match(estatisticas, /Dossiê do colaborador/);
assert.match(estatisticas, /Abrir NC #/);
assert.doesNotMatch(estatisticas, /bg-primary/);
assert.match(usuarios, />Dossiê/);
assert.doesNotMatch(usuarios, /react-bootstrap\/Badge/);
assert.match(navegacao, /Meu dossiê/);
assert.match(app, /\/usuarios\/:usuarioId\/dossie/);

assert.match(detalhes, /window\.print\(\)/);
assert.match(detalhes, /sg-print-cabecalho/);
assert.match(estilos, /@media print/);
assert.match(estilos, /@page/);

function canalLinear(valorHex) {
  const canal = Number.parseInt(valorHex, 16) / 255;
  return canal <= 0.03928
    ? canal / 12.92
    : ((canal + 0.055) / 1.055) ** 2.4;
}

function luminancia(cor) {
  const hex = cor.replace("#", "");
  return (
    0.2126 * canalLinear(hex.slice(0, 2)) +
    0.7152 * canalLinear(hex.slice(2, 4)) +
    0.0722 * canalLinear(hex.slice(4, 6))
  );
}

function contraste(frente, fundo) {
  const maior = Math.max(luminancia(frente), luminancia(fundo));
  const menor = Math.min(luminancia(frente), luminancia(fundo));
  return (maior + 0.05) / (menor + 0.05);
}

const badgesPapel = [
  ["#ffffff", "#17324d"],
  ["#174c79", "#e8f0f7"],
  ["#44525b", "#edf0f1"],
];
for (const [texto, fundo] of badgesPapel) {
  assert(
    contraste(texto, fundo) >= 4.5,
    `Contraste insuficiente para badge: ${texto} sobre ${fundo}`
  );
}

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
