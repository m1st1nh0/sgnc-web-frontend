import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { dentroDoExpediente, lembreteAceite, somarHorasExpediente } from "../src/lib/notificacoes/lembretes";
import { resumirNotificacoes } from "../src/lib/notificacoes/resumo";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261010140000_notificacoes.sql");
const sp = (local: string) => new Date(`${local}:00-03:00`);
const corpoEvento = (evento: string) => {
  const inicio = migracao.indexOf(`p_evento = '${evento}'`);
  return migracao.slice(inicio, migracao.indexOf("ELSIF p_evento", inicio + 10));
};

test("5.7: prazo de 18 h de expediente igual ao banco (exemplos do plano)", () => {
  const casos: Array<[string, string]> = [
    ["2026-10-12T14:00", "2026-10-14T14:00"], // segunda 14h → quarta 14h
    ["2026-10-16T15:00", "2026-10-20T15:00"], // sexta 15h → terça 15h
    ["2026-10-12T17:00", "2026-10-14T17:00"], // segunda 17h → quarta 17h
    ["2026-10-16T20:00", "2026-10-20T18:00"], // sexta 20h → terça 18h
    ["2026-10-17T10:00", "2026-10-20T18:00"], // sábado 10h → terça 18h
    ["2026-10-12T07:00", "2026-10-13T18:00"], // segunda 7h → terça 18h
    ["2026-10-16T18:00", "2026-10-20T18:00"], // sexta 18h (fim do expediente) → terça 18h
  ];
  for (const [inicio, esperado] of casos) expect(somarHorasExpediente(sp(inicio), 18).toISOString()).toBe(sp(esperado).toISOString());
});

test("5.7: lembretes só no expediente e subindo de nível em horas de expediente", () => {
  expect(dentroDoExpediente(sp("2026-10-17T10:00"))).toBe(false); // sábado
  expect(dentroDoExpediente(sp("2026-10-12T08:59"))).toBe(false);
  expect(dentroDoExpediente(sp("2026-10-12T09:00"))).toBe(true);
  expect(dentroDoExpediente(sp("2026-10-12T18:00"))).toBe(false);

  // Envio segunda 14h, prazo quarta 14h.
  const envio = sp("2026-10-12T14:00");
  const prazo = somarHorasExpediente(envio, 18);
  expect(lembreteAceite(sp("2026-10-12T15:00"), envio, prazo)).toBeNull(); // mesmo dia: só o aviso normal do envio
  expect(lembreteAceite(sp("2026-10-13T09:00"), envio, prazo)).toBe("atencao"); // 9h do dia útil seguinte
  expect(lembreteAceite(sp("2026-10-13T09:15"), envio, prazo, "atencao")).toBeNull(); // não repete
  expect(lembreteAceite(sp("2026-10-14T09:59"), envio, prazo, "atencao")).toBeNull(); // faltam 4h01
  expect(lembreteAceite(sp("2026-10-14T10:00"), envio, prazo, "atencao")).toBe("urgente"); // faltam 4 h
  expect(lembreteAceite(sp("2026-10-14T10:15"), envio, prazo, "urgente")).toBeNull();
  expect(lembreteAceite(sp("2026-10-14T14:00"), envio, prazo, "urgente")).toBeNull(); // venceu: vira "Não respondida"

  // Envio sexta 18h: prazo terça 18h; atenção na segunda 9h; urgente na terça 14h (4 h antes).
  const sexta = sp("2026-10-16T18:00");
  const prazoSexta = somarHorasExpediente(sexta, 18);
  expect(lembreteAceite(sp("2026-10-17T10:00"), sexta, prazoSexta)).toBeNull(); // sábado: nada
  expect(lembreteAceite(sp("2026-10-19T09:00"), sexta, prazoSexta)).toBe("atencao");
  expect(lembreteAceite(sp("2026-10-20T14:00"), sexta, prazoSexta, "atencao")).toBe("urgente");

  // Envio no fim de semana e antes das 9h começam a contar às 9h do dia útil.
  const domingo = sp("2026-10-18T11:00");
  expect(somarHorasExpediente(domingo, 18).toISOString()).toBe(sp("2026-10-20T18:00").toISOString());
  const madrugada = sp("2026-10-12T07:00");
  expect(lembreteAceite(sp("2026-10-12T09:00"), madrugada, somarHorasExpediente(madrugada, 18))).toBeNull();
  expect(lembreteAceite(sp("2026-10-13T09:00"), madrugada, somarHorasExpediente(madrugada, 18))).toBe("atencao");
  expect(lembreteAceite(sp("2026-10-13T14:00"), madrugada, somarHorasExpediente(madrugada, 18), "atencao")).toBe("urgente");
});

test("5.2: regras dos lembretes no banco iguais às do espelho", () => {
  const lembretes = migracao.slice(migracao.indexOf("FUNCTION public.lembretes_notificacoes_v1"));
  expect(lembretes).toContain("v_local::time < time '09:00' OR v_local::time >= time '18:00'");
  expect(lembretes).toContain("public.somar_horas_expediente(v_agora, 4) >= v_item.prazo_aceite");
  expect(lembretes).toContain("NOT IN ('urgente', 'critica')");
  expect(lembretes).toContain("v_hoje > (v_item.registrado_em AT TIME ZONE 'America/Sao_Paulo')::date");
  expect(migracao).toContain("cron.schedule('sgnc-lembretes-notificacoes', '*/15 * * * *'");
});

test("5.7 matriz: NC aberta só para a Qualidade, sem quem abriu e sem o acusado (D10, D16)", () => {
  const aberta = corpoEvento("nc_aberta");
  expect(aberta).toContain("unnest(v_qualidade)");
  expect(aberta).not.toContain("'acusado'");
  expect(aberta).not.toContain("'autor'");
  // R2: a versão Qualidade nunca vai para o acusado (Qualidade acusada).
  expect(migracao).toContain("WHERE q IS DISTINCT FROM v_nc.colaborador_id");
  // R1: o executor (quem abriu) sai pelo filtro geral.
  expect(migracao).toContain("c.u IS DISTINCT FROM p_autor_id");
});

test("5.7 matriz: validação avisa Qualidade, acusado, líder e quem abriu; invalidação só quem abriu", () => {
  const validada = corpoEvento("nc_validada");
  for (const papel of ["'qualidade'", "'acusado'", "'lider'", "'autor'"]) expect(validada).toContain(papel);
  const invalidada = corpoEvento("nc_invalidada");
  expect(invalidada).toContain("'autor'");
  expect(invalidada).not.toContain("'qualidade'");
  expect(invalidada).toContain("motivo_invalidacao");
});

test("5.7 matriz: R3 (uma por pessoa, a mais relevante) e prioridades", () => {
  expect(migracao).toContain("SELECT DISTINCT ON (c.u) c.*");
  expect(migracao).toContain("ORDER BY c.u, c.p");
  // acusado 1 < responsável 2 < líder 3 < quem abriu 4 < Qualidade 5
  expect(corpoEvento("feedback_aplicado")).toMatch(/'acusado', 'p', 1[\s\S]*'responsavel_acao', 'p', 2[\s\S]*'lider', 'p', 3/);
  expect(corpoEvento("nc_validada")).toMatch(/'qualidade', 'p', 5[\s\S]*'autor', 'p', 4/);
});

test("5.7 matriz: líder direto; NC crítica avisa a cadeia (R7, D17); R5 para o responsável pela ação", () => {
  expect(migracao).toContain("public.lideranca_de(v_nc.colaborador_id, v_nc.critica)");
  const lideranca = migracao.slice(migracao.indexOf("FUNCTION public.lideranca_de"), migracao.indexOf("FUNCTION public.proximo_dia_util"));
  expect(lideranca).toContain("WHERE p_cadeia AND");
  expect(lideranca).toContain("u.papel = 'supervisor'::public.papel_usuario");
  expect(corpoEvento("feedback_aplicado")).toContain("public.nc_lidera_colaborador(v_fb.responsavel_acao_id, v_nc.colaborador_id)");
  expect(corpoEvento("nc_critica")).not.toContain("unnest(v_qualidade)"); // quem marcou é da Qualidade (R1)
});

test("5.7 matriz: não respondida avisa acusado e líder em nível crítica, sem a Qualidade (D9, D12)", () => {
  const naoRespondida = corpoEvento("nao_respondida");
  expect(naoRespondida).toContain("'acusado'");
  expect(naoRespondida).toContain("'lider'");
  expect(naoRespondida).toContain("'nivel', 'critica'");
  expect(naoRespondida).not.toContain("unnest(v_qualidade)");
});

test("5.3: pendências são resolvidas quando acabam (R4) e lembretes não empilham", () => {
  expect(corpoEvento("aceite_registrado")).toContain("public.resolver_pendencias(p_nc_id, 'aceite')");
  expect(migracao).toContain("PERFORM public.resolver_pendencias(p_nc_id, 'avaliar')");
  expect(migracao).toContain("PERFORM public.resolver_pendencias(p_nc_id, 'feedback')");
  expect(migracao).toContain("CREATE UNIQUE INDEX notificacoes_usuario_chave_idx ON public.notificacoes (usuario_id, chave_agrupamento)");
  expect(migracao).toContain("lida_em = NULL, resolvida_em = NULL");
});

test("5.2: eventos nascem na mesma transação (triggers nas tabelas que as RPCs gravam)", () => {
  for (const gatilho of ["AFTER INSERT ON public.historico_nc", "AFTER UPDATE OF critica ON public.nao_conformidades", "AFTER INSERT ON public.plano_acao_acompanhamentos", "AFTER UPDATE OF status ON public.planos_acao", "AFTER INSERT OR UPDATE OF status ON public.medidas_disciplinares", "AFTER INSERT OR UPDATE OF status ON public.solicitacoes_causa"]) {
    expect(migracao).toContain(gatilho);
  }
  expect(migracao).toContain("REVOKE ALL ON TABLE public.notificacoes FROM PUBLIC, anon, authenticated");
});

test("5.5/5.7: a API só lê e marca as notificações da própria pessoa", () => {
  const servico = read("src/lib/notificacoes/service.ts");
  expect(servico.match(/\.eq\("usuario_id", user\.id\)/g)?.length).toBeGreaterThanOrEqual(4);
  expect(servico).not.toMatch(/usuario_id", input|usuario_id", body/);
  for (const rota of ["src/app/api/notificacoes/route.ts", "src/app/api/notificacoes/[notificacaoId]/lida/route.ts", "src/app/api/notificacoes/lidas/route.ts"]) {
    expect(read(rota)).toContain("@/lib/notificacoes/service");
  }
});

test("5.6: contador de não lidas e cor pelo maior nível pendente; não resolvidas primeiro", () => {
  const resumo = resumirNotificacoes([
    { id: 1, nivel: "normal", lida_em: null, resolvida_em: null, criada_em: "2026-10-10T10:00:00Z" },
    { id: 2, nivel: "critica", lida_em: null, resolvida_em: "2026-10-10T12:00:00Z", criada_em: "2026-10-10T11:00:00Z" },
    { id: 3, nivel: "urgente", lida_em: null, resolvida_em: null, criada_em: "2026-10-10T09:00:00Z" },
    { id: 4, nivel: "critica", lida_em: "2026-10-10T13:00:00Z", resolvida_em: null, criada_em: "2026-10-10T13:00:00Z" },
  ]);
  expect(resumo.nao_lidas).toBe(2);
  expect(resumo.maior_nivel).toBe("urgente");
  expect(resumo.itens.map((item) => item.id)).toEqual([4, 1, 3, 2]);
  expect(resumirNotificacoes([]).maior_nivel).toBeNull();
  const sino = read("src/features/notificacoes/components/SinoNotificacoes.jsx");
  expect(sino).toContain("INTERVALO_MS = 60_000");
  expect(sino).toContain('document.visibilityState === "visible"');
  expect(sino).toContain('window.addEventListener("focus"');
});
