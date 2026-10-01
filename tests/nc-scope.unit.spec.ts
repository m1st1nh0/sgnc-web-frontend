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
  const ncService = readFileSync("src/lib/nc/service.ts", "utf8");
  expect(analytics).toContain('.in("status", [...SUPERVISOR_VISIBLE_NC_STATUSES])');
  expect(analytics).toContain('.in("nc_id", all.map((nc) => nc.id))');
  expect(reports).toContain('.in("status",[...SUPERVISOR_VISIBLE_NC_STATUSES])');
  expect(ncService).toContain("buildNcReadScopeFilter(user, teamIds)");
});
