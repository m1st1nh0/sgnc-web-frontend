import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20261001174449_cause_catalog_governance.sql", "utf8");
const service = await readFile("src/lib/nc/service.ts", "utf8");
const campo = await readFile("src/features/nc/components/CampoCausas.jsx", "utf8");
const adminPage = await readFile("src/features/nc/components/CausasPage.jsx", "utf8");
const paths = [
  "src/app/api/nc/causas/solicitacoes/route.ts",
  "src/app/api/nc/causas/solicitacoes/decidir/route.ts",
  "src/app/(app)/causas/page.tsx",
];
const routeTexts = await Promise.all(paths.map((path) => readFile(path, "utf8")));

assert.match(migration, /ADD COLUMN ativo boolean NOT NULL DEFAULT true/i);
assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? public\.solicitacoes_causa/i);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(migration, /CREATE UNIQUE INDEX solicitacoes_causa_pendente_normalizada_uidx/i);
assert.match(migration, /WHERE status = 'pendente'/i);
assert.match(migration, /FOR UPDATE/i);
assert.match(migration, /decidir_solicitacao_causa/i);
for (const cause of [
  "Chamado sem previsão", "Chamado com previsão vencida", "Não retornou ao cliente",
  "Sem apontamento", "Assunto não aplicado", "Não seguiu a macro", "Direcionamento fila errada",
  "Chamado não encerrado no mesmo dia", "Campo solicitante não ajustado",
  "Apontamento de horas incoerente", "Conduta contra o regulamento interno", "Erros de ponto",
]) assert.ok(migration.includes(`('${cause}')`), `missing initial cause: ${cause}`);
assert.match(service, /\.eq\("ativo", true\)/);
assert.match(service, /solicitarCausa/);
assert.match(service, /decidirSolicitacaoCausa/);
assert.match(campo, /Solicitar análise/);
assert.match(campo, /permitirCriacaoDireta/);
assert.match(adminPage, /decidirSolicitacaoCausa/);
assert.match(routeTexts[1], /requireApiUser/);
assert.match(routeTexts[2], /requireRole\(\["adm"\]\)/);
console.log("PR11 cause catalog governance regression passed");
