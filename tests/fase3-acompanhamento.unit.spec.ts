import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { acaoPendente, etapasDaNc } from "../src/features/nc/client/statusNc.js";
import { eventosDaTimeline } from "../src/lib/nc/timeline";

const read = (path: string) => readFileSync(path, "utf8");
const situacoes = (nc: Record<string, unknown>, quem?: string) =>
  etapasDaNc(nc, quem).map((etapa: { chave: string; situacao: string }) => `${etapa.chave}:${etapa.situacao}`);

test("3.6: status → etapa atual na trilha Aberta → Avaliação → Feedback → Aceite → Concluída", () => {
  expect(situacoes({ status: "aberta" })).toEqual(["abertura:feita", "avaliacao:atual", "feedback:pendente", "aceite:pendente", "concluida:pendente"]);
  expect(situacoes({ status: "aguardando_feedback" })).toEqual(["abertura:feita", "avaliacao:feita", "feedback:atual", "aceite:pendente", "concluida:pendente"]);
  expect(situacoes({ status: "aguardando_analise" })[2]).toBe("feedback:atual");
  expect(situacoes({ status: "validada" })[2]).toBe("feedback:atual");
  expect(situacoes({ status: "aguardando_aceite" })[3]).toBe("aceite:atual");
  expect(situacoes({ status: "concluida" }).every((item: string) => item.endsWith(":feita"))).toBe(true);
});

test("3.6: NC crítica ganha a etapa Plano de ação entre Aceite e Concluída", () => {
  expect(situacoes({ status: "aguardando_feedback", critica: true })).toEqual(["abertura:feita", "avaliacao:feita", "feedback:atual", "aceite:pendente", "plano_acao:pendente", "concluida:pendente"]);
  expect(situacoes({ status: "em_plano_acao", critica: true })).toEqual(["abertura:feita", "avaliacao:feita", "feedback:feita", "aceite:feita", "plano_acao:atual", "concluida:pendente"]);
  expect(situacoes({ status: "concluida", critica: true })).toHaveLength(6);
});

test("3.6: NC invalidada encerra a trilha na avaliação, sem ação pendente", () => {
  const etapas = etapasDaNc({ status: "invalidada" });
  expect(etapas.map((etapa: { rotulo: string; situacao: string }) => `${etapa.rotulo}:${etapa.situacao}`)).toEqual(["Aberta:feita", "Invalidada:encerrada"]);
  expect(acaoPendente({ status: "invalidada" })).toBeNull();
  expect(acaoPendente({ status: "concluida" })).toBeNull();
});

test("3.6: responsável da etapa (Qualidade, nome do colaborador, liderança) e 'Você' para quem deve agir", () => {
  expect(acaoPendente({ status: "aberta" })?.responsavel).toBe("Qualidade");
  expect(acaoPendente({ status: "aguardando_feedback" })?.responsavel).toBe("Qualidade");
  const aceite = { status: "aguardando_aceite", colaborador: "Ana Souza", colaborador_id: "u-ana" };
  expect(acaoPendente(aceite, "u-outro")?.responsavel).toBe("Ana Souza");
  expect(acaoPendente(aceite, "u-ana")?.responsavel).toBe("Você");
  expect(acaoPendente({ status: "aguardando_aceite" })?.responsavel).toBe("Colaborador analisado");
  expect(acaoPendente({ status: "em_plano_acao", critica: true })?.responsavel).toBe("Qualidade e liderança");
  const atual = etapasDaNc(aceite, "u-ana").find((etapa: { situacao: string }) => etapa.situacao === "atual");
  expect(atual?.responsavel).toBe("Você");
});

const autores = new Map([
  ["u-qual", { id: "u-qual", nome: "Carla Qualidade", papel: "qualidade" }],
  ["u-sup", { id: "u-sup", nome: "Sérgio Supervisor", papel: "supervisor" }],
  ["u-func", { id: "u-func", nome: "Fábio Colaborador", papel: "funcionario" }],
]);
const eventos = [
  { id: 1, usuario_id: "u-func", status_anterior: null, status_novo: "aberta", observacao: "NC aberta", criado_em: "2026-10-01T12:00:00Z" },
  { id: 2, usuario_id: "u-qual", status_anterior: "aberta", status_novo: "aguardando_feedback", observacao: "Validada com 2ª ocorrência", criado_em: "2026-10-02T12:00:00Z" },
  { id: 3, usuario_id: null, status_anterior: "aguardando_aceite", status_novo: "concluida", observacao: "Automático", criado_em: "2026-10-03T12:00:00Z" },
  { id: 4, usuario_id: "u-apagado", status_anterior: "aguardando_feedback", status_novo: "aguardando_aceite", observacao: "x", criado_em: "2026-10-03T13:00:00Z" },
];

test("3.1: com acesso completo, o histórico traz o nome do autor de cada evento", () => {
  const resultado = eventosDaTimeline(eventos, autores, "u-sup", true);
  expect(resultado.map((evento) => evento.autor_nome)).toEqual(["Fábio Colaborador", "Carla Qualidade", "Sistema", "Usuário removido"]);
  expect(resultado[1].observacao).toBe("Validada com 2ª ocorrência");
});

test("3.1: com acesso restrito, nomes de terceiros viram o papel e a observação é ocultada", () => {
  const resultado = eventosDaTimeline(eventos, autores, "u-func", false);
  expect(resultado.map((evento) => evento.autor_nome)).toEqual(["Você", "Qualidade", "Sistema", "Sistema"]);
  expect(resultado.every((evento) => evento.observacao === null)).toBe(true);
  expect(resultado[1].usuario_id).toBeNull();
  expect(resultado[0].usuario_id).toBe("u-func");
  expect(JSON.stringify(resultado)).not.toContain("Carla Qualidade");
  expect(eventosDaTimeline([{ ...eventos[1], usuario_id: "u-sup" }], autores, "u-func", false)[0].autor_nome).toBe("Liderança");
});

test("3.1: obterTimeline usa o acesso calculado por buscarNc e o mesmo usuário da requisição", () => {
  const service = read("src/lib/nc/service.ts");
  const corpo = service.slice(service.indexOf("export async function obterTimeline"), service.indexOf("type DisciplinaryMeasureInput"));
  expect(corpo).toContain("buscarNc(id, user)");
  expect(corpo).toContain('eventosDaTimeline(data ?? [], autores, user.id, nc.acesso_completo === true)');
});

test("3.2–3.5: detalhe com etapas e histórico, confirmação após abrir e coluna Aguardando nas listas", () => {
  const detalhe = read("src/features/nc/components/DetalhesNcPage.jsx");
  expect(detalhe).toContain("<EtapasNc nc={nc} visualizadorId={usuario?.id} />");
  expect(detalhe).toContain("<HistoricoNc ncId={id}");
  expect(detalhe).not.toContain("Próxima ação:");
  expect(detalhe).toContain("Próximo passo: a Qualidade avalia.");
  expect(read("src/features/nc/components/AbrirNcPage.jsx")).toContain("sgnc-nc-${nc.id}-registrada");
  expect(read("src/features/nc/components/HistoricoNc.jsx")).toContain("obterTimeline(ncId)");
  expect(read("src/features/nc/client/ncService.js")).toContain("/nc/${id}/timeline");
  const home = read("src/features/nc/components/HomePage.jsx");
  expect(home).toContain('"Status", "Aguardando"]');
  expect(home).toContain('colSpan={8}');
  expect(read("src/features/nc/components/MinhasNcsPage.jsx")).toContain("Aguardando:");
});
