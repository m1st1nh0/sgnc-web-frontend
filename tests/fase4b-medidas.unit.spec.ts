import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { podeAplicarMedida, podeAtuarNaMedida, podeDecidirMedida } from "../src/lib/permissions/medidas";
import { situacaoDaMedida } from "../src/features/nc/client/medidas.js";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261010130000_medida_disciplinar_etapas.sql");
const usuario = (id: string, papel: "adm" | "qualidade" | "supervisor" | "funcionario") =>
  ({ id, nome: id, email: `${id}@x`, papel, ativo: true, senha_provisoria: false });

test("4B.5/D19: Qualidade acusada não decide nem aplica a própria medida", () => {
  const sugerida = { colaborador_id: "q1", status: "sugerida" };
  const aprovada = { colaborador_id: "q1", status: "aprovada" };
  expect(podeDecidirMedida(sugerida, usuario("q1", "qualidade"))).toBe(false);
  expect(podeAplicarMedida(aprovada, usuario("q1", "qualidade"))).toBe(false);
  expect(podeAtuarNaMedida(sugerida, usuario("q1", "adm"))).toBe(false);
  expect(podeDecidirMedida(sugerida, usuario("q2", "qualidade"))).toBe(true);
  expect(podeAplicarMedida(aprovada, usuario("a1", "adm"))).toBe(true);
});

test("4B.5: só a Qualidade atua e cada ação só vale na etapa certa", () => {
  const sugerida = { colaborador_id: "c1", status: "sugerida" };
  expect(podeDecidirMedida(sugerida, usuario("s1", "supervisor"))).toBe(false);
  expect(podeDecidirMedida(sugerida, usuario("f1", "funcionario"))).toBe(false);
  expect(podeAplicarMedida(sugerida, usuario("q2", "qualidade"))).toBe(false);
  expect(podeDecidirMedida({ ...sugerida, status: "aprovada" }, usuario("q2", "qualidade"))).toBe(false);
  for (const status of ["reprovada", "aplicada", "cancelada"]) {
    expect(podeDecidirMedida({ ...sugerida, status }, usuario("q2", "qualidade"))).toBe(false);
    expect(podeAplicarMedida({ ...sugerida, status }, usuario("q2", "qualidade"))).toBe(false);
  }
});

test("4B.1: etapas, colunas e D19 também no banco (CHECK), com índice único contra duplicidade", () => {
  expect(migracao).toContain("CHECK (status IN ('sugerida', 'aprovada', 'reprovada', 'aplicada', 'cancelada'))");
  for (const coluna of ["decidida_por", "decidida_em", "motivo_decisao", "aplicada_em"]) expect(migracao).toContain(`ADD COLUMN ${coluna}`);
  expect(migracao).toContain("decidida_por IS DISTINCT FROM colaborador_id AND aplicada_por IS DISTINCT FROM colaborador_id");
  expect(migracao).toContain("status <> 'reprovada' OR motivo_decisao IS NOT NULL");
  // Índice único já existente em produção; a validação usa ON CONFLICT nele.
  expect(migracao).toContain("on conflict (nc_id, causa_id, ocorrencia_gatilho) do nothing");
});

test("4B.2: validação cria a medida sugerida na mesma transação, pela mesma regra da API", () => {
  const validacao = migracao.slice(migracao.indexOf("CREATE OR REPLACE FUNCTION public.validar_nc_com_ocorrencias_v2"), migracao.indexOf("CREATE OR REPLACE FUNCTION public.decidir_medida_v1"));
  expect(validacao).toContain("v_medida := public.medida_sugerida_para(v_numero);");
  expect(validacao).toContain("'sugerida'");
  // Reincidência da Fase 4 preservada.
  expect(validacao).toContain("'nao_respondida'::public.status_nc");
  expect(validacao).toContain("'em_plano_acao'::public.status_nc");
  const regra = migracao.slice(migracao.indexOf("FUNCTION public.medida_sugerida_para"), migracao.indexOf("$$;", migracao.indexOf("FUNCTION public.medida_sugerida_para")));
  expect(regra).toContain("(p_ocorrencia - 4) % 3 <> 0");
  expect(regra).toContain("<= 3 THEN 'advertencia'");
  expect(regra).toContain("<= 6 THEN 'suspensao'");
  expect(regra).toContain("ELSE 'avaliar_justa_causa'");
});

test("4B.3: RPCs travam a linha, exigem Qualidade sem conflito e motivo ao reprovar", () => {
  for (const funcao of ["decidir_medida_v1", "aplicar_medida_v1"]) {
    const corpo = migracao.slice(migracao.indexOf(`FUNCTION public.${funcao}(`), migracao.indexOf("$$;", migracao.indexOf(`FUNCTION public.${funcao}(`)));
    expect(corpo).toContain("FOR UPDATE");
    expect(corpo).toContain("'conflito_interesse'");
    expect(corpo).toContain("papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)");
    expect(migracao).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${funcao}\\(.*FROM PUBLIC, anon, authenticated`));
  }
  expect(migracao).toContain("IF p_decisao = 'reprovar' AND (v_motivo IS NULL OR length(v_motivo) < 10)");
  expect(migracao).toContain("IF v_medida.status <> 'aprovada' THEN");
});

test("4B.4: tela de medidas esconde as ações da própria pessoa e o registro manual direto foi removido", () => {
  const pagina = read("src/features/nc/components/MedidasPage.jsx");
  expect(pagina).toContain("medida.permissoes?.decidir");
  expect(pagina).toContain("medida.permissoes?.aplicar");
  expect(pagina).toContain("Você é o colaborador desta medida");
  expect(read("src/lib/nc/medidas.ts")).toContain("permissoes: { decidir: podeDecidirMedida(medida, user), aplicar: podeAplicarMedida(medida, user) }");
  const estatisticas = read("src/features/users/components/EstatisticasUsuarioPage.jsx");
  expect(estatisticas).toContain("ehAdm && !ehPropriaEstatistica");
  expect(estatisticas).not.toContain("Registrar medida");
  expect(existsSync("src/features/nc/components/ModalRegistrarMedida.jsx")).toBe(false);
  expect(read("src/lib/nc/service.ts")).not.toContain("registrarMedidaDisciplinar");
  expect(read("src/app/(app)/medidas/page.tsx")).toContain('requireRole(["adm", "qualidade"])');
  expect(situacaoDaMedida("aprovada").rotulo).toBe("Aprovada, a aplicar");
});

test("4B (10/10): ao aprovar, a Qualidade pode trocar o tipo sugerido, com justificativa", () => {
  expect(migracao).toContain("ADD COLUMN tipo_sugerido text");
  expect(migracao).toContain("tipo_sugerido IS NULL OR tipo = tipo_sugerido OR motivo_decisao IS NOT NULL");
  expect(migracao).toContain("p_tipo text DEFAULT NULL");
  expect(migracao).toContain("'justificativa_tipo'");
  expect(migracao).toContain("v_medida, v_medida, 'sugerida'");
  const servidor = read("src/lib/nc/medidas.ts");
  expect(servidor).toContain("tipo !== (medida.tipo_sugerido ?? medida.tipo) && motivo.length < 10");
  expect(servidor).toContain("p_tipo: tipo");
  const pagina = read("src/features/nc/components/MedidasPage.jsx");
  expect(pagina).toContain("Justifique a troca do tipo sugerido");
  expect(pagina).toContain('rotulo="Medida aprovada"');
});

test("4B: Insights conta como aplicadas só as medidas aplicadas", () => {
  expect(read("src/lib/analytics/service.ts")).toContain("if(measure.status!=='aplicada')continue;");
});
