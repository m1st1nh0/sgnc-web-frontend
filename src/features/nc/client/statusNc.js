/**
 * Fonte única de verdade para a apresentação dos status da NC.
 * `etapa` conecta o estado de negócio aos tokens visuais sem alterar a API.
 */
export const STATUS_INFO = {
  aberta: { rotulo: "Aberta", cor: "secondary", etapa: "aberta" },
  invalidada: { rotulo: "Invalidada", cor: "danger", etapa: "invalidada" },
  aguardando_feedback: { rotulo: "Aguardando feedback", cor: "warning", etapa: "aguardando-feedback" },
  aguardando_aceite: { rotulo: "Aguardando aceite", cor: "warning", etapa: "aguardando-aceite" },
  nao_respondida: { rotulo: "Não respondida", cor: "danger", etapa: "nao-respondida" },
  em_plano_acao: { rotulo: "Em plano de ação", cor: "danger", etapa: "em-plano-acao" },
  // Fase 5 do processo: verificação de eficácia em 30 dias e seus desdobramentos.
  reaberta: { rotulo: "Reaberta", cor: "danger", etapa: "em-plano-acao" },
  em_verificacao: { rotulo: "Em verificação", cor: "info", etapa: "aguardando-aceite" },
  nao_eficaz: { rotulo: "Não eficaz", cor: "danger", etapa: "nao-respondida" },
  escalada: { rotulo: "Escalada", cor: "warning", etapa: "nao-respondida" },
  concluida: { rotulo: "Concluída", cor: "success", etapa: "concluida" },
  validada: { rotulo: "Validada (legado)", cor: "info", etapa: "validada" },
  aguardando_analise: { rotulo: "Aguardando feedback", cor: "warning", etapa: "aguardando-feedback" },
};

export function infoDoStatus(status) {
  return STATUS_INFO[status] ?? {
    rotulo: status,
    cor: "secondary",
    etapa: "desconhecida",
  };
}

/** Etapa do fluxo em que a NC está, por status (status legados caem na etapa equivalente). */
const ETAPA_DO_STATUS = {
  aberta: "avaliacao",
  invalidada: "avaliacao",
  aguardando_feedback: "feedback",
  aguardando_analise: "feedback",
  validada: "feedback",
  aguardando_aceite: "aceite",
  nao_respondida: "aceite",
  em_plano_acao: "plano_acao",
  reaberta: "plano_acao",
  em_verificacao: "verificacao",
  nao_eficaz: "verificacao",
  escalada: "verificacao",
  concluida: "concluida",
};

const ROTULO_ETAPA = {
  abertura: "Aberta",
  avaliacao: "Avaliação",
  analise: "Análise de causa",
  feedback: "Feedback",
  aceite: "Aceite",
  plano_acao: "Plano de ação",
  verificacao: "Verificação de eficácia",
  concluida: "Concluída",
};

const STATUS_FEEDBACK = new Set(["aguardando_feedback", "aguardando_analise", "validada"]);

/** A NC aguarda a análise de causa: tem prazo de análise e a análise ainda não foi registrada. */
export function analisePendente(nc) {
  return !!nc && STATUS_FEEDBACK.has(nc.status) && !!nc.prazo_analise && !nc.analise_registrada_em;
}

function vencido(prazo, agora) {
  return !!prazo && Date.parse(prazo) < agora.getTime();
}

/**
 * Quem precisa agir agora e o quê. `null` quando não há ação pendente.
 * Quando o visualizador é quem deve agir, o responsável aparece como "Você".
 */
export function acaoPendente(nc, visualizadorId) {
  if (!nc) return null;
  const colaborador = nc.colaborador || "Colaborador analisado";
  const acoes = {
    aberta: ["Qualidade", "Avaliar a ocorrência e definir se ela segue para análise."],
    aguardando_feedback: ["Qualidade", "Registrar o feedback e o combinado com o colaborador."],
    aguardando_analise: ["Qualidade", "Registrar o feedback e o combinado com o colaborador."],
    validada: ["Qualidade", "Registrar o feedback e o combinado com o colaborador."],
    aguardando_aceite: [colaborador, "Ler o feedback e registrar o aceite formal."],
    nao_respondida: [colaborador, "O prazo do aceite venceu. O aceite ainda pode ser registrado e ficará marcado como fora do prazo."],
    em_plano_acao: ["Qualidade e liderança", "Executar e acompanhar o plano de ação; a Qualidade conclui o plano e verifica a eficácia em 30 dias."],
    reaberta: ["Qualidade e liderança", "Nova rodada do plano de ação, depois da verificação não eficaz."],
    em_verificacao: ["Qualidade", "Verificar a eficácia do plano em até 30 dias e registrar eficaz ou não eficaz."],
    nao_eficaz: ["Qualidade", "Decidir se a NC é reaberta (novo plano) ou escalada ao gestor do departamento."],
    escalada: ["Gestor do departamento", "Registrar o parecer para encerrar a NC."],
  };
  // Fase 3 do processo: NC com prazo de análise passa pela análise de causa antes do feedback.
  if (analisePendente(nc)) return { responsavel: "Qualidade", descricao: "Registrar a análise de causa (por que a não conformidade aconteceu)." };
  const acao = acoes[nc.status];
  if (!acao) return null;
  const ehVoce = (["aguardando_aceite", "nao_respondida"].includes(nc.status) && !!visualizadorId && nc.colaborador_id === visualizadorId)
    || (nc.status === "escalada" && !!visualizadorId && nc.escalada_para === visualizadorId);
  return { responsavel: ehVoce ? "Você" : acao[0], descricao: acao[1] };
}

/**
 * Trilha de etapas da NC: Aberta → Avaliação → (Análise de causa, se a NC tem prazo de análise) → Feedback
 * → Aceite → (Plano de ação, se crítica) → Concluída.
 * Cada etapa vem com `situacao`: "feita", "atual", "atrasada" (prazo vencido; no aceite, NC "Não respondida"),
 * "pendente" ou "encerrada" (NC invalidada na avaliação). A etapa atual traz o `prazo` quando ele existe.
 */
export function etapasDaNc(nc, visualizadorId, agora = new Date()) {
  if (!nc) return [];
  const comPlano = nc.critica === true || nc.plano_acao_aberto === true || ["em_plano_acao", "reaberta", "em_verificacao", "nao_eficaz", "escalada"].includes(nc.status);
  // NC com plano passa pela verificação de eficácia (Fase 5), exceto a concluída antes dela existir.
  const comVerificacao = comPlano && (nc.status !== "concluida" || !!nc.verificacao_resultado || !!nc.escalada_para);
  const comAnalise = !!(nc.prazo_analise || nc.analise_registrada_em);
  const chaves = ["abertura", "avaliacao", ...(comAnalise ? ["analise"] : []), "feedback", "aceite",
    ...(comPlano ? ["plano_acao"] : []), ...(comVerificacao ? ["verificacao"] : []), "concluida"];
  const atual = analisePendente(nc) ? "analise" : ETAPA_DO_STATUS[nc.status];
  const indiceAtual = chaves.indexOf(atual);
  const pendente = acaoPendente(nc, visualizadorId);

  if (nc.status === "invalidada") {
    return [
      { chave: "abertura", rotulo: ROTULO_ETAPA.abertura, situacao: "feita", responsavel: null },
      { chave: "avaliacao", rotulo: "Invalidada", situacao: "encerrada", responsavel: null },
    ];
  }
  return chaves.map((chave, indice) => {
    let situacao = "pendente";
    if (nc.status === "concluida" || indice < indiceAtual) situacao = "feita";
    else if (indice === indiceAtual) situacao = ["nao_respondida", "nao_eficaz", "escalada"].includes(nc.status) ? "atrasada" : "atual";
    const prazoEtapa = { analise: nc.prazo_analise, feedback: nc.prazo_feedback, aceite: nc.feedback_estruturado?.prazo_aceite,
      verificacao: nc.status === "em_verificacao" ? nc.verificacao_ate : null }[chave] ?? null;
    // A janela de verificação terminar não é atraso: a Qualidade registra o resultado no 30º dia.
    if (situacao === "atual" && !["aceite", "verificacao"].includes(chave) && vencido(prazoEtapa, agora)) situacao = "atrasada";
    const ehAtual = situacao === "atual" || situacao === "atrasada";
    return {
      chave,
      rotulo: situacao === "atrasada" && chave === "aceite" ? "Não respondida"
        : situacao === "atrasada" && chave === "verificacao" ? (nc.status === "escalada" ? "Escalada" : "Não eficaz")
        : chave === "plano_acao" && nc.status === "reaberta" ? "Plano de ação (reaberta)"
        : ROTULO_ETAPA[chave],
      situacao,
      responsavel: ehAtual ? pendente?.responsavel ?? null : null,
      prazo: ehAtual ? prazoEtapa : null,
    };
  });
}
