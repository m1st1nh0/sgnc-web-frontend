import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { situacaoDaMedida } from "../src/features/nc/client/medidas.js";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261013120000_medida_ciclo_tres_ncs.sql");
const corpo = (nome: string) => {
  const inicio = migracao.indexOf(`FUNCTION public.${nome}(`);
  return migracao.slice(inicio, migracao.indexOf("$$;", inicio));
};

test("processo 1 (Q1): ciclo de 12 meses a partir da 1ª NC da causa; fechada a janela, tudo zera", () => {
  const ciclo = corpo("ocorrencia_no_ciclo");
  expect(ciclo).toContain("IF v_inicio IS NULL OR v_item.data >= (v_inicio + interval '12 months')::date THEN");
  expect(ciclo).toContain("v_n := 0;");
  expect(ciclo).toContain("JOIN public.nc_causas AS rel ON rel.nc_id = nc.id AND rel.causa_id = p_causa_id");
  // NC não respondida e em plano de ação continuam contando (Fase 4).
  expect(ciclo).toContain("'nao_respondida'::public.status_nc");
  expect(ciclo).toContain("'em_plano_acao'::public.status_nc");
});

test("processo 1 (P3): a cada 3 NCs da mesma causa no ciclo, passível de medida", () => {
  const validacao = corpo("validar_nc_com_ocorrencias_v2");
  expect(validacao).toContain("if v_ciclo.numero % 3 = 0 then");
  expect(validacao).toContain("public.proxima_medida_do_ciclo(v_nc.colaborador_id, v_causa.causa_id, v_ciclo.inicio_ciclo)");
  expect(validacao).not.toContain("medida_sugerida_para");
  expect(migracao).toContain("ADD CONSTRAINT medidas_disciplinares_ocorrencia_gatilho_check CHECK (ocorrencia_gatilho >= 1)");
});

test("processo 1 (Q2, 14/10): escada por causa no ciclo; só contam medidas aprovadas pela Qualidade", () => {
  const escada = corpo("proxima_medida_do_ciclo");
  expect(escada).toContain("WHEN n.ordem <= 3 THEN 'advertencia'");
  expect(escada).toContain("WHEN n.ordem <= 6 THEN 'suspensao'");
  expect(escada).toContain("ELSE 'avaliar_justa_causa'");
  expect(escada).toContain("AND m.causa_id = p_causa_id");
  expect(escada).toContain("AND m.status IN ('aprovada', 'aplicada')");
});

test("processo 1 (Q5, 14/10): NC crítica passível de medida em cada causa; junta com a da contagem, sem duplicar", () => {
  const critica = corpo("medida_para_nc_critica");
  expect(critica).toContain("SELECT rel.causa_id, rel.ocorrencia_numero FROM public.nc_causas AS rel WHERE rel.nc_id = p_nc_id ORDER BY rel.causa_id");
  expect(critica).toContain("SET origem = 'reincidencia_e_critica'");
  expect(critica).toContain("'sugerida', 'nc_critica'");
  expect(migracao).toContain("CHECK (origem IN ('reincidencia', 'nc_critica', 'reincidencia_e_critica'))");
  expect(migracao).toContain("FOR EACH ROW WHEN (NEW.critica AND NOT OLD.critica) EXECUTE FUNCTION public.medida_ao_marcar_critica()");
});

test("processo 1 (Q3): pendências da regra antiga recalculadas, sem avisos em massa", () => {
  expect(migracao).toContain("ALTER TABLE public.medidas_disciplinares DISABLE TRIGGER notificar_medida;");
  expect(migracao).toContain("ALTER TABLE public.medidas_disciplinares ENABLE TRIGGER notificar_medida;");
  expect(migracao).toMatch(/SET status = 'cancelada',[\s\S]*WHERE status = 'sugerida';/);
});

test("processo 1 (Q4): na interface e no aviso, 'Passível de medida'; o RH aplica presencialmente", () => {
  expect(situacaoDaMedida("sugerida").rotulo).toBe("Passível de medida");
  expect(migracao).toContain("'Colaborador passível de medida'");
  const pagina = read("src/features/nc/components/MedidasPage.jsx");
  expect(pagina).toContain("A aplicação é feita pelo RH, presencialmente.");
  expect(pagina).toContain('medida.origem === "nc_critica"');
  // A regra fica só no banco: o servidor não recalcula a medida por conta própria.
  expect(read("src/lib/nc/service.ts")).not.toContain("suggestedMeasure");
  expect(read("src/lib/analytics/service.ts")).not.toContain("suggestedMeasure");
});
