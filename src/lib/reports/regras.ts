/** Regras puras dos relatórios: período anterior, comparação, etapa atual e o bloco "Pede atenção". */
import { dataBr, dataHoraBr, plural, rotuloStatus, rotuloTipoMedida } from "./formato";

type Row = Record<string, any>;
const DIA = 86_400_000;

export const STATUS_ATIVOS = new Set(["aberta", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "validada", "aguardando_analise", "em_verificacao", "nao_eficaz", "reaberta", "escalada"]);

/** Período anterior com o mesmo número de dias, terminando na véspera do início (R-D3). */
export function periodoAnterior(inicio: string, fim: string) {
  const ini = Date.parse(`${inicio}T12:00:00Z`), end = Date.parse(`${fim}T12:00:00Z`);
  const dias = Math.round((end - ini) / DIA) + 1;
  const fimAnterior = new Date(ini - DIA);
  const inicioAnterior = new Date(ini - DIA * dias);
  return { inicio: inicioAnterior.toISOString().slice(0, 10), fim: fimAnterior.toISOString().slice(0, 10), dias };
}

/** Linha de comparação do cartão: "anterior: 2 (+2)" ou "anterior: 80% (+20 p.p.)". */
export function comparacao(atual: number | null, anterior: number | null, tipo: "numero" | "percentual" = "numero") {
  if (tipo === "percentual") {
    if (anterior == null) return "anterior: sem aceites";
    const pct = (valor: number) => `${String(Math.round(valor * 1000) / 10).replace(".", ",")}%`;
    if (atual == null) return `anterior: ${pct(anterior)}`;
    const delta = Math.round((atual - anterior) * 1000) / 10;
    return `anterior: ${pct(anterior)} (${delta === 0 ? "igual" : `${delta > 0 ? "+" : ""}${String(delta).replace(".", ",")} p.p.`})`;
  }
  const antes = anterior ?? 0, agora = atual ?? 0;
  const delta = agora - antes;
  return `anterior: ${antes} (${delta === 0 ? "igual" : `${delta > 0 ? "+" : ""}${delta}`})`;
}

/** Momento em que a NC entrou na etapa atual; null para NC encerrada. */
export function inicioDaEtapa(nc: Row): string | null {
  if (!STATUS_ATIVOS.has(nc.status)) return null;
  if (nc.status === "aberta") return nc.criado_em ?? null;
  if (nc.status === "aguardando_aceite" || nc.status === "nao_respondida") return nc.feedback_aplicado_em || nc.validado_em || nc.criado_em || null;
  if (nc.status === "em_verificacao") return nc.verificacao_inicio || nc.aceito_em || nc.criado_em || null;
  if (nc.status === "nao_eficaz") return nc.verificacao_registrada_em || nc.criado_em || null;
  if (nc.status === "escalada") return nc.escalada_em || nc.criado_em || null;
  if (nc.status === "em_plano_acao" || nc.status === "reaberta") return nc.aceito_em || nc.validado_em || nc.criado_em || null;
  return nc.validado_em || nc.enviado_em || nc.criado_em || null;
}

export function diasNaEtapa(nc: Row, agora = new Date()) {
  const desde = inicioDaEtapa(nc);
  return desde ? Math.max(0, Math.floor((agora.getTime() - Date.parse(desde)) / DIA)) : null;
}

/** Ordem da lista de NCs: o que pede ação primeiro, depois as mais recentes. */
const PRIORIDADE: Record<string, number> = { nao_respondida: 0, aguardando_aceite: 1, aberta: 2, aguardando_feedback: 3, validada: 3, aguardando_analise: 3, em_plano_acao: 4, reaberta: 4, nao_eficaz: 4, escalada: 4, em_verificacao: 4, concluida: 5, invalidada: 6 };
export function ordenarParaAcao(a: Row, b: Row) {
  return (PRIORIDADE[a.status] ?? 9) - (PRIORIDADE[b.status] ?? 9)
    || String(b.data || b.criado_em).localeCompare(String(a.data || a.criado_em))
    || Number(b.id) - Number(a.id);
}

export type NivelAtencao = "critico" | "atencao" | "info";
export type ItemAtencao = { nivel: NivelAtencao; rotulo: string; texto: string; ncs: number[] };

const ids = (lista: Row[]) => lista.map((nc) => Number(nc.id)).sort((a, b) => a - b);
const hora = (valor: string) => dataHoraBr(valor).slice(11);

/**
 * Bloco "Pede atenção" da página 1, a partir das regras que já existem no sistema:
 * prazo do aceite, NCs não respondidas, NC crítica em andamento, medida disciplinar pendente
 * e a NC parada há mais tempo na mesma etapa.
 */
export function itensDeAtencao({ ativas, medidas = [], agora = new Date() }: { ativas: Row[]; medidas?: Row[]; agora?: Date }): ItemAtencao[] {
  const itens: ItemAtencao[] = [];
  const hoje = dataBr(agora.toISOString());
  const amanha = dataBr(new Date(agora.getTime() + DIA).toISOString());

  const aceites = ativas.filter((nc) => nc.status === "aguardando_aceite" && nc.prazo_aceite);
  const vencidos = aceites.filter((nc) => Date.parse(nc.prazo_aceite) <= agora.getTime());
  if (vencidos.length) itens.push({ nivel: "critico", rotulo: "Prazo vencido", texto: `${plural(vencidos.length, "aceite")} com prazo vencido. ${vencidos.length === 1 ? "A NC passa" : "As NCs passam"} para Não respondida.`, ncs: ids(vencidos) });
  const porDia = new Map<string, Row[]>();
  for (const nc of aceites) {
    if (Date.parse(nc.prazo_aceite) <= agora.getTime()) continue;
    const dia = dataBr(nc.prazo_aceite);
    if (dia !== hoje && dia !== amanha) continue;
    const chave = `${dia === hoje ? "hoje" : "amanhã"} às ${hora(nc.prazo_aceite)}`;
    porDia.set(chave, [...(porDia.get(chave) ?? []), nc]);
  }
  for (const [quando, lista] of porDia) {
    const hojeMesmo = quando.startsWith("hoje");
    itens.push({
      nivel: hojeMesmo ? "critico" : "atencao",
      rotulo: hojeMesmo ? "Vence hoje" : "Vence amanhã",
      texto: `${lista.length === 1 ? "1 aceite vence" : `${lista.length} aceites vencem`} ${quando}. Sem aceite, ${lista.length === 1 ? "a NC passa" : "as NCs passam"} para Não respondida.`,
      ncs: ids(lista),
    });
  }

  const naoRespondidas = ativas.filter((nc) => nc.status === "nao_respondida");
  const jaCitadas = new Set([...itens.flatMap((item) => item.ncs), ...naoRespondidas.map((nc) => Number(nc.id))]);
  if (naoRespondidas.length) itens.push({ nivel: "critico", rotulo: "Sem aceite", texto: `${plural(naoRespondidas.length, "NC", "NCs")} em Não respondida. O colaborador ainda pode aceitar, e o aceite fica marcado como fora do prazo.`, ncs: ids(naoRespondidas) });

  const criticas = ativas.filter((nc) => nc.critica === true);
  if (criticas.length) itens.push({ nivel: "critico", rotulo: "Crítica", texto: `${plural(criticas.length, "NC crítica", "NCs críticas")} em andamento.`, ncs: ids(criticas) });

  for (const medida of medidas.filter((item) => item.status === "sugerida" || item.status === "aprovada")) {
    const tipo = rotuloTipoMedida(medida.tipo);
    const causa = medida.causa ? ` de "${medida.causa}"` : "";
    itens.push({
      nivel: "atencao",
      rotulo: "Reincidência",
      texto: medida.status === "sugerida"
        ? `${medida.ocorrencia_gatilho}ª ocorrência${causa} com o mesmo colaborador. ${tipo} sugerida, aguardando decisão da Qualidade.`
        : `${tipo} aprovada${causa}, aguardando aplicação.`,
      ncs: medida.nc_id != null ? [Number(medida.nc_id)] : [],
    });
  }

  // A NC parada há mais tempo, sem repetir uma que já aparece pelo prazo do aceite.
  const paradas = ativas
    .filter((nc) => !jaCitadas.has(Number(nc.id)))
    .map((nc) => ({ nc, dias: diasNaEtapa(nc, agora) ?? 0, desde: Date.parse(inicioDaEtapa(nc) ?? "") }))
    .filter((item) => item.dias >= 2)
    .sort((a, b) => a.desde - b.desde || Number(a.nc.id) - Number(b.nc.id));
  if (paradas.length) {
    const { nc, dias } = paradas[0];
    itens.push({ nivel: "info", rotulo: "Parada", texto: `${rotuloStatus(nc.status)} há ${plural(dias, "dia")}. É a NC há mais tempo na mesma etapa.`, ncs: [Number(nc.id)] });
  }

  const ordem: Record<NivelAtencao, number> = { critico: 0, atencao: 1, info: 2 };
  return itens.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}
