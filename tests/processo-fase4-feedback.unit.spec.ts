import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { ApiError } from "../src/lib/api/error";
import { erroDoFeedback, validarFeedback } from "../src/lib/nc/feedback";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261019140000_feedback_completo.sql");
const corpo = (nome: string) => {
  const inicio = migracao.indexOf(`FUNCTION public.${nome}(`);
  return migracao.slice(inicio, migracao.indexOf("$$;", inicio));
};
const base = {
  causa_raiz: "c", acao_combinada: "a", responsavel_acao_id: "00000000-0000-4000-8000-000000000001",
  prazo_acao: "2026-10-20", combinado: "x", resumo_conversa: "Conversa",
};
const quarta = new Date("2026-10-14T15:00:00Z");
const campo = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as ApiError).campo; } return null; };

test("processo 4 (Q10): resumo obrigatório, participantes opcionais (até 20) e posicionamento liberado pela Qualidade", () => {
  expect(campo(() => validarFeedback({ ...base, resumo_conversa: " " }, quarta))).toBe("resumo_conversa");
  expect(campo(() => validarFeedback({ ...base, participantes: ["x"] }, quarta))).toBe("participantes");
  expect(campo(() => validarFeedback({ ...base, participantes: Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`) }, quarta))).toBe("participantes");
  const id = "00000000-0000-4000-8000-000000000009";
  expect(validarFeedback({ ...base, participantes: [id, id], liberar_posicionamento: true }, quarta))
    .toMatchObject({ participantes: [id], liberar_posicionamento: true });
  expect(validarFeedback({ ...base, liberar_posicionamento: "sim" }, quarta).liberar_posicionamento).toBe(false);
  expect(erroDoFeedback({ erro: "participantes_invalidos" })).toMatchObject({ campo: "participantes" });
});

test("processo 4: feedback v6 e aceite v5 no banco", () => {
  const feedback = corpo("registrar_feedback_v6");
  expect(feedback).toContain("'campo', 'resumo_conversa'");
  expect(feedback).toContain("'participantes_invalidos'");
  // Valida antes de chamar a v5 e só grava o complemento quando ela der certo.
  expect(feedback.indexOf("'participantes_invalidos'")).toBeLessThan(feedback.indexOf("public.registrar_feedback_v5("));
  expect(feedback).toContain("IF NOT coalesce((v_resultado ->> 'ok')::boolean, false) THEN RETURN v_resultado; END IF;");
  const aceite = corpo("aceitar_nc_v5");
  expect(aceite).toContain("NOT v_feedback.posicionamento_liberado");
  expect(aceite.indexOf("'posicionamento_nao_liberado'")).toBeLessThan(aceite.indexOf("public.aceitar_nc_v4("));
  expect(migracao).toContain("CHECK (posicionamento_colaborador IS NULL OR posicionamento_liberado)");
  expect(migracao).toContain("ALTER TABLE public.nc_feedback_participantes ENABLE ROW LEVEL SECURITY;");
  expect(migracao).toContain("REVOKE ALL ON TABLE public.nc_feedback_participantes FROM PUBLIC, anon, authenticated;");
});

test("processo 4 (N3/N5): validação exige evidência; medida só é aprovada com o feedback aplicado", () => {
  const validacao = corpo("validar_nc_com_workflow_v5");
  expect(validacao).toContain("FOR UPDATE");
  expect(validacao).toContain("FROM public.evidencias WHERE nc_id = p_nc_id AND feedback_id IS NULL");
  const medida = corpo("decidir_medida_v2");
  expect(medida).toContain("p_decisao = 'aprovar'");
  expect(medida).toContain("feedback_aplicado_em IS NULL");
  expect(medida).toContain("RETURN public.decidir_medida_v1(");
  expect(read("src/lib/nc/medidas.ts")).toContain('medidaRpc("decidir_medida_v2"');
  for (const funcao of ["registrar_feedback_v6", "aceitar_nc_v5", "validar_nc_com_workflow_v5", "decidir_medida_v2"]) {
    expect(migracao).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${funcao}\\(.*FROM PUBLIC, anon, authenticated`));
  }
});

test("processo 4: telas mostram resumo, participantes e posicionamento", () => {
  const painel = read("src/features/nc/components/PainelFeedback.jsx");
  expect(painel).toContain('rotulo="Resumo da conversa"');
  expect(painel).toContain("+ Posicionamento do colaborador");
  expect(read("src/features/nc/components/PainelAceite.jsx")).toContain("posicionamentoLiberado");
  const detalhe = read("src/features/nc/components/FeedbackNc.jsx");
  expect(detalhe).toContain("Participantes");
  expect(detalhe).toContain("Posicionamento do colaborador");
  expect(read("src/lib/reports/service.ts")).toContain('writer.line("Resumo da conversa"');
});
