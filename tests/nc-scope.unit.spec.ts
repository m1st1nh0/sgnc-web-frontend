import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { buildNcReadScopeFilter, buildNcTeamScopeFilter, SUPERVISOR_VISIBLE_NC_STATUSES } from "../src/lib/permissions/nc-scope";
import { filterSensitive } from "../src/lib/permissions/nc";

const supervisor = {
  id: "supervisor-id",
  nome: "Supervisor",
  email: "supervisor@example.test",
  papel: "supervisor" as const,
  ativo: true,
  senha_provisoria: false,
};

test("supervisor read scope includes the full history of their current hierarchy", () => {
  expect(SUPERVISOR_VISIBLE_NC_STATUSES).toEqual([
    "aberta",
    "aguardando_feedback",
    "aguardando_analise",
    "validada",
    "aguardando_aceite",
    "nao_respondida",
    "em_plano_acao",
    "concluida",
    "invalidada",
  ]);
  expect(buildNcReadScopeFilter(supervisor, ["colaborador-a", "colaborador-b"])).toBe(
    "aberto_por.eq.supervisor-id,and(status.in.(aberta,aguardando_feedback,aguardando_analise,validada,aguardando_aceite,nao_respondida,em_plano_acao,concluida,invalidada),colaborador_id.in.(supervisor-id,colaborador-a,colaborador-b))",
  );
  expect(buildNcReadScopeFilter({ ...supervisor, papel: "adm" }, [])).toBeNull();
  expect(buildNcTeamScopeFilter(supervisor, ["colaborador-a"])).toBe("colaborador_id.in.(supervisor-id,colaborador-a)");
  expect(buildNcTeamScopeFilter({ ...supervisor, papel: "adm" }, [])).toBeNull();
});

test("privileged analytics and exports enforce the same supervisor scope", () => {
  const analytics = readFileSync("src/lib/analytics/service.ts", "utf8");
  const reports = readFileSync("src/lib/reports/service.ts", "utf8");
  const drilldown = readFileSync("src/lib/analytics/drilldown.ts", "utf8");
  const ncService = readFileSync("src/lib/nc/service.ts", "utf8");
  expect(analytics).toContain("buildNcTeamScopeFilter(user, teamIds)");
  expect(reports).toContain("buildNcTeamScopeFilter(requester,teamIds)");
  expect(drilldown).toContain("buildNcTeamScopeFilter(user, teamIds)");
  expect(analytics).toContain('.in("nc_id", all.map((nc) => nc.id))');
  expect(ncService).toContain("buildNcReadScopeFilter(user, teamIds)");
});

test("insights KPIs and charts expose a scoped NC drilldown", () => {
  const page = readFileSync("src/features/insights/components/InsightsPage.jsx", "utf8");
  const endpoint = readFileSync("src/app/api/insights/ncs/route.ts", "utf8");
  expect(page).toContain("cardInterativo");
  expect(page).toContain("onCategoryClick");
  expect(page).toContain("onPointClick");
  expect(page).toContain("ModalNcsIndicador");
  expect(endpoint).toContain("listarNcsDoIndicador");
});

test("employees see their own validated and invalidated NCs with the invalidation reason", () => {
  const funcionario = { ...supervisor, id: "funcionario-id", papel: "funcionario" as const };
  const scope = buildNcReadScopeFilter(funcionario, []);
  expect(scope).toContain("validada");
  expect(scope).toContain("invalidada");
  expect(scope).toContain("colaborador_id.in.(funcionario-id)");
  const nc = { aberto_por: "autor", colaborador_id: funcionario.id, status: "invalidada", motivo_invalidacao: "Evidência insuficiente" };
  expect(filterSensitive(nc, funcionario).motivo_invalidacao).toBe("Evidência insuficiente");
});
