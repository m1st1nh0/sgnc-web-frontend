import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapearProfundidadeLiderados } from "./src/lib/permissions/hierarchy.js";

const pessoas = [
  { id: "supervisor-a", supervisor_id: "lider", papel: "supervisor" },
  { id: "funcionario-a", supervisor_id: "supervisor-a", papel: "funcionario" },
  { id: "funcionario-b", supervisor_id: "lider", papel: "funcionario" },
  { id: "fora-da-equipe", supervisor_id: "outra-lideranca", papel: "funcionario" },
  // Dado corrompido/cíclico não pode duplicar o líder nem ampliar o escopo.
  { id: "lider", supervisor_id: "funcionario-a", papel: "supervisor" },
];

const niveis = mapearProfundidadeLiderados("lider", pessoas);
assert.deepEqual([...niveis.entries()].sort(), [
  ["funcionario-a", 2],
  ["funcionario-b", 1],
  ["supervisor-a", 1],
].sort());
assert.equal(niveis.has("fora-da-equipe"), false);
assert.equal(niveis.has("lider"), false);

const equipeRoute = readFileSync("src/app/(app)/equipe/page.tsx", "utf8");
const pessoaRoute = readFileSync("src/app/(app)/equipe/[usuarioId]/page.tsx", "utf8");
const api = readFileSync("src/app/api/equipe/[usuarioId]/ncs/route.ts", "utf8");
const escopo = readFileSync("src/lib/permissions/nc-scope.ts", "utf8");
const nav = readFileSync("src/components/navigation/BarraNavegacao.jsx", "utf8");

assert.match(equipeRoute, /requireRole\(\["adm", "qualidade", "supervisor"\]\)/);
assert.match(pessoaRoute, /requireRole\(\["adm", "qualidade", "supervisor"\]\)/);
assert.match(api, /listarNcsDaPessoa/);
assert.match(escopo, /"invalidada"/);
assert.match(nav, /href="\/equipe"/);

console.log("HIERARCHICAL TEAM ACCESS TESTS PASSED");
