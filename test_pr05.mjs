import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  criarVisaoHome,
  normalizarStatusHome,
} from "./src/services/homeUx.js";

assert.equal(normalizarStatusHome("validada"), "aguardando_feedback");
assert.equal(normalizarStatusHome("aguardando_analise"), "aguardando_feedback");
assert.equal(normalizarStatusHome("concluida"), "concluida");

const ncs = [
  {
    id: 1,
    status: "aberta",
    colaborador_id: "u1",
    aberto_por: "adm",
    criado_em: "2026-08-20T10:00:00Z",
  },
  {
    id: 2,
    status: "aguardando_feedback",
    colaborador_id: "u1",
    aberto_por: "u1",
    criado_em: "2026-08-21T10:00:00Z",
  },
  {
    id: 3,
    status: "aguardando_aceite",
    colaborador_id: "u1",
    aberto_por: "outro",
    criado_em: "2026-08-22T10:00:00Z",
  },
  {
    id: 4,
    status: "concluida",
    colaborador_id: "u1",
    aberto_por: "u1",
    criado_em: "2026-08-23T10:00:00Z",
  },
  {
    id: 5,
    status: "aguardando_aceite",
    colaborador_id: "u2",
    aberto_por: "u2",
    criado_em: "2026-08-24T10:00:00Z",
  },
  {
    id: 6,
    status: "concluida",
    colaborador_id: "u2",
    aberto_por: "u2",
    criado_em: "2026-08-25T10:00:00Z",
  },
];

const adm = criarVisaoHome({ id: "adm", papel: "adm" }, ncs);
assert.equal(adm.cards.find((c) => c.rotulo === "Aguardando avaliação").valor, 1);
assert.equal(adm.cards.find((c) => c.rotulo === "Aguardando feedback").valor, 1);
assert.equal(adm.cards.find((c) => c.rotulo === "Aguardando aceite").valor, 2);

const supervisor = criarVisaoHome(
  { id: "sup", papel: "supervisor" },
  ncs,
  ["u1"]
);
assert.equal(supervisor.cards.find((c) => c.rotulo === "NCs da equipe").valor, 4);
assert.equal(supervisor.cards.find((c) => c.rotulo === "Aguardando aceite").valor, 1);
assert.equal(supervisor.cards.find((c) => c.rotulo === "Concluídas").valor, 1);
assert.ok(supervisor.prioridades.every((nc) => nc.colaborador_id === "u1"));
assert.ok(!supervisor.prioridades.some((nc) => nc.id === 5));

const funcionario = criarVisaoHome(
  { id: "u1", papel: "funcionario" },
  ncs
);
assert.equal(
  funcionario.cards.find((c) => c.rotulo === "Aguardando meu aceite").valor,
  1
);
assert.equal(
  funcionario.cards.find((c) => c.rotulo === "Abertas por mim").valor,
  2
);
assert.ok(
  funcionario.prioridades.every(
    (nc) => nc.colaborador_id === "u1" || nc.aberto_por === "u1"
  )
);

const app = readFileSync("src/App.jsx", "utf8");
assert.match(app, /papeis=\{\["adm"\]\}/);
assert.match(app, /papeis=\{\["adm", "supervisor"\]\}/);

const home = readFileSync("src/pages/HomePage.jsx", "utf8");
assert.match(home, /listarOpcoesNc/);
assert.match(home, /listarUsuarios/);

const detalhes = readFileSync("src/pages/DetalhesNcPage.jsx", "utf8");
assert.match(detalhes, /Tentar novamente/);
assert.match(detalhes, /bloqueado=\{enviandoArquivo\}/);
assert.match(detalhes, /await anexarEvidencia/);

console.log("PR05 ROLE-AWARE UX TESTS PASSED");
