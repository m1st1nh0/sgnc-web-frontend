import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  apresentacaoDoPapel,
  checklistDoPapel,
  DICAS_ONBOARDING,
} from "./src/data/onboardingConteudo.js";

const papeis = ["adm", "supervisor", "funcionario"];
const esperados = {
  adm: ["checklist_avaliar_nc", "checklist_feedback", "checklist_usuarios"],
  supervisor: ["checklist_equipe", "checklist_acompanhar_nc"],
  funcionario: ["checklist_evidencias", "checklist_aceite"],
};

for (const papel of papeis) {
  const apresentacao = apresentacaoDoPapel(papel);
  const checklist = checklistDoPapel(papel, "usuario-1");
  assert.equal(apresentacao.length, 4);
  assert.equal(new Set(apresentacao.map((item) => item.chave)).size, 4);
  assert(checklist.length >= 7);
  assert.equal(new Set(checklist.map((item) => item.chave)).size, checklist.length);
  assert(checklist.some((item) => item.chave === "checklist_baixar_pdf"));
  assert(checklist.some((item) => item.destino === "/usuarios/usuario-1/dossie"));
  for (const chave of esperados[papel]) {
    assert(checklist.some((item) => item.chave === chave));
  }
}

for (const chave of [
  "checklist_avaliar_nc",
  "checklist_feedback",
  "checklist_evidencias",
  "checklist_aceite",
]) {
  const itens = [
    ...checklistDoPapel("adm", "usuario-1"),
    ...checklistDoPapel("funcionario", "usuario-1"),
  ];
  assert.equal(
    itens.find((item) => item.chave === chave)?.concluirAoAbrir,
    true
  );
}

assert(DICAS_ONBOARDING.dica_abertura_evidencias);
assert(DICAS_ONBOARDING.dica_nc_pdf);
assert(DICAS_ONBOARDING.dica_nc_aceite);

const app = readFileSync("src/App.jsx", "utf8");
const contexto = readFileSync("src/context/OnboardingContext.jsx", "utf8");
const modal = readFileSync(
  "src/components/onboarding/OnboardingInicialModal.jsx",
  "utf8"
);
const checklist = readFileSync(
  "src/components/onboarding/OnboardingChecklist.jsx",
  "utf8"
);
const dica = readFileSync(
  "src/components/onboarding/DicaContextual.jsx",
  "utf8"
);
const home = readFileSync("src/pages/HomePage.jsx", "utf8");
const abertura = readFileSync("src/pages/AbrirNcPage.jsx", "utf8");
const detalhes = readFileSync("src/pages/DetalhesNcPage.jsx", "utf8");
const dossie = readFileSync("src/pages/EstatisticasUsuarioPage.jsx", "utf8");
const navbar = readFileSync("src/components/BarraNavegacao.jsx", "utf8");
const estilos = readFileSync("src/redesign.css", "utf8");

assert.match(app, /<OnboardingProvider>/);
assert.match(app, /<OnboardingInicialModal \/>/);
assert.match(contexto, /nunca pode bloquear as rotas de negócio/);
assert.match(contexto, /setIndisponivel\(true\)/);
assert.match(modal, /Continuar depois/);
assert.match(modal, /aria-valuenow/);
assert.match(checklist, /Seus primeiros passos/);
assert.match(checklist, /Ocultar primeiros passos/);
assert.match(dica, /concluirEtapa\(chave, "contextual"/);
assert.match(navbar, />\s*Guia\s*</);
assert.match(home, /<OnboardingChecklist \/>/);
assert.match(abertura, /dica_abertura_colaborador/);
assert.match(abertura, /dica_abertura_evidencias/);
assert.match(detalhes, /dica_nc_avaliacao/);
assert.match(detalhes, /dica_nc_feedback/);
assert.match(detalhes, /dica_nc_aceite/);
assert.match(detalhes, /checklist_baixar_pdf/);
assert.match(dossie, /checklist_dossie/);
assert.match(dossie, /checklist_baixar_pdf/);
assert.match(estilos, /prefers-reduced-motion/);
assert.match(estilos, /sg-onboarding-checklist/);

console.log("HYBRID ONBOARDING FRONTEND TESTS PASSED");
