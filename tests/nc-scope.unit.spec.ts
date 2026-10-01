import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { buildNcReadScopeFilter, SUPERVISOR_VISIBLE_NC_STATUSES } from "../src/lib/permissions/nc-scope";

const supervisor = {
  id: "supervisor-id",
  nome: "Supervisor",
  email: "supervisor@example.test",
  papel: "supervisor" as const,
  ativo: true,
  senha_provisoria: false,
};

test("supervisor read scope matches the authenticated database status allowlist", () => {
  expect(SUPERVISOR_VISIBLE_NC_STATUSES).toEqual([
    "aguardando_feedback",
    "aguardando_analise",
    "aguardando_aceite",
    "concluida",
  ]);
  expect(buildNcReadScopeFilter(supervisor, ["colaborador-a", "colaborador-b"])).toBe(
    "aberto_por.eq.supervisor-id,and(status.in.(aguardando_feedback,aguardando_analise,aguardando_aceite,concluida),colaborador_id.in.(supervisor-id,colaborador-a,colaborador-b))",
  );
  expect(buildNcReadScopeFilter({ ...supervisor, papel: "adm" }, [])).toBeNull();
});

test("privileged analytics and exports enforce the same supervisor scope", () => {
  const analytics = readFileSync("src/lib/analytics/service.ts", "utf8");
  const reports = readFileSync("src/lib/reports/service.ts", "utf8");
  const drilldown = readFileSync("src/lib/analytics/drilldown.ts", "utf8");
  const ncService = readFileSync("src/lib/nc/service.ts", "utf8");
  expect(analytics).toContain("buildNcReadScopeFilter(user, teamIds)");
  expect(reports).toContain("buildNcReadScopeFilter(requester,teamIds)");
  expect(drilldown).toContain("buildNcReadScopeFilter(user, teamIds)");
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
