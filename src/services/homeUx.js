const STATUS_FEEDBACK = new Set([
  "aguardando_feedback",
  "validada",
  "aguardando_analise",
]);

const STATUS_ATIVOS = new Set([
  "aberta",
  "aguardando_feedback",
  "validada",
  "aguardando_analise",
  "aguardando_aceite",
]);

export function normalizarStatusHome(status) {
  return STATUS_FEEDBACK.has(status) ? "aguardando_feedback" : status;
}

function contar(ncs, status) {
  return ncs.filter((nc) => normalizarStatusHome(nc.status) === status).length;
}

function porPrioridade(a, b) {
  const ordem = {
    aguardando_aceite: 0,
    aberta: 1,
    aguardando_feedback: 2,
    validada: 2,
    aguardando_analise: 2,
    concluida: 3,
    invalidada: 4,
  };
  const diferenca = (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9);
  if (diferenca !== 0) return diferenca;
  return String(b.criado_em || b.data || "").localeCompare(
    String(a.criado_em || a.data || "")
  );
}

function limitarPrioridades(ncs) {
  return [...ncs].sort(porPrioridade).slice(0, 5);
}

export function criarVisaoHome(usuario, ncs, equipeIds = []) {
  const papel = usuario?.papel;

  if (papel === "adm") {
    const prioridades = ncs.filter((nc) =>
      ["aberta", "aguardando_feedback", "validada", "aguardando_analise"].includes(
        nc.status
      )
    );

    return {
      titulo: "Gestão de Não Conformidades",
      subtitulo: "Priorize avaliações, feedbacks e o acompanhamento do fluxo.",
      destaque: {
        rotulo: "Visão da Qualidade",
        titulo:
          contar(ncs, "aberta") > 0
            ? `${contar(ncs, "aberta")} NC(s) aguardam avaliação`
            : "Nenhuma avaliação pendente",
        descricao:
          contar(ncs, "aguardando_feedback") > 0
            ? `${contar(ncs, "aguardando_feedback")} NC(s) procedentes ainda aguardam feedback.`
            : "O fluxo administrativo está sem feedbacks pendentes.",
        acao: { rotulo: "Ver ações da Qualidade", destino: "#prioridades" },
      },
      atalhos: [
        { rotulo: "Analisar indicadores", descricao: "Backlog, tempos e reincidência", destino: "/insights", icone: "↗" },
        { rotulo: "Emitir relatórios", descricao: "PDF gerencial e CSV detalhado", destino: "/relatorios", icone: "⇩" },
        { rotulo: "Gerenciar usuários", descricao: "Cadastros, papéis e equipes", destino: "/usuarios", icone: "◉" },
      ],
      tituloPrioridades: "Ações da Qualidade",
      vazioPrioridades: "Nenhuma ação administrativa pendente no momento.",
      tituloLista: "Todas as NCs visíveis",
      cards: [
        {
          rotulo: "Aguardando avaliação",
          valor: contar(ncs, "aberta"),
          descricao: "NCs que precisam de decisão",
          cor: "amarela",
        },
        {
          rotulo: "Aguardando feedback",
          valor: contar(ncs, "aguardando_feedback"),
          descricao: "NCs procedentes sem feedback",
          cor: "laranja",
        },
        {
          rotulo: "Aguardando aceite",
          valor: contar(ncs, "aguardando_aceite"),
          descricao: "Feedback aplicado",
          cor: "azul",
        },
        {
          rotulo: "Concluídas",
          valor: contar(ncs, "concluida"),
          descricao: "Ciclos encerrados",
          cor: "verde",
        },
      ],
      prioridades: limitarPrioridades(prioridades),
    };
  }

  if (papel === "supervisor") {
    const ids = new Set(equipeIds);
    const equipe = ncs.filter((nc) => ids.has(nc.colaborador_id));
    const prioridades = equipe.filter((nc) => STATUS_ATIVOS.has(nc.status));

    return {
      titulo: "Acompanhamento da Equipe",
      subtitulo: "Acompanhe somente as NCs dos seus subordinados diretos.",
      destaque: {
        rotulo: "Sua equipe direta",
        titulo:
          prioridades.length > 0
            ? `${prioridades.length} NC(s) ativas em acompanhamento`
            : "Equipe sem NC ativa no momento",
        descricao:
          contar(equipe, "aguardando_aceite") > 0
            ? `${contar(equipe, "aguardando_aceite")} NC(s) aguardam confirmação após o feedback.`
            : "Não há aceites pendentes na equipe direta.",
        acao: { rotulo: "Ver equipe em acompanhamento", destino: "#prioridades" },
      },
      atalhos: [
        { rotulo: "Insights da equipe", descricao: "Somente subordinados diretos", destino: "/insights", icone: "↗" },
        { rotulo: "Relatórios da equipe", descricao: "PDF e CSV dentro do seu escopo", destino: "/relatorios", icone: "⇩" },
        { rotulo: "Minhas estatísticas", descricao: "Seus indicadores pessoais separados", destino: `/usuarios/${usuario.id}/estatisticas`, icone: "≡" },
      ],
      tituloPrioridades: "Equipe em acompanhamento",
      vazioPrioridades: "Sua equipe não possui NCs ativas visíveis no momento.",
      tituloLista: "NCs visíveis para você",
      cards: [
        {
          rotulo: "NCs da equipe",
          valor: equipe.length,
          descricao: "Registros visíveis da equipe direta",
          cor: "azul",
        },
        {
          rotulo: "Aguardando feedback",
          valor: contar(equipe, "aguardando_feedback"),
          descricao: "Em tratamento pela Qualidade",
          cor: "laranja",
        },
        {
          rotulo: "Aguardando aceite",
          valor: contar(equipe, "aguardando_aceite"),
          descricao: "Pendentes de confirmação",
          cor: "amarela",
        },
        {
          rotulo: "Concluídas",
          valor: contar(equipe, "concluida"),
          descricao: "Ciclos encerrados da equipe",
          cor: "verde",
        },
      ],
      prioridades: limitarPrioridades(prioridades),
    };
  }

  const minhasNcs = ncs.filter((nc) => nc.colaborador_id === usuario?.id);
  const abertasPorMim = ncs.filter((nc) => nc.aberto_por === usuario?.id);
  const prioridades = ncs.filter(
    (nc) =>
      (nc.colaborador_id === usuario?.id && STATUS_ATIVOS.has(nc.status)) ||
      (nc.aberto_por === usuario?.id && STATUS_ATIVOS.has(nc.status))
  );

  return {
    titulo: "Minhas Não Conformidades",
    subtitulo: "Veja o que exige sua atenção e acompanhe os registros que você abriu.",
    destaque: {
      rotulo: "Seu próximo passo",
      titulo:
        contar(minhasNcs, "aguardando_aceite") > 0
          ? `${contar(minhasNcs, "aguardando_aceite")} feedback(s) aguardam seu aceite`
          : "Nenhum aceite pendente",
      descricao:
        prioridades.length > 0
          ? `Você possui ${prioridades.length} NC(s) ativa(s) para acompanhar.`
          : "Você está em dia. Continue acompanhando seu histórico pessoal.",
      acao: {
        rotulo:
          contar(minhasNcs, "aguardando_aceite") > 0
            ? "Ver o que precisa de atenção"
            : "Consultar minhas estatísticas",
        destino:
          contar(minhasNcs, "aguardando_aceite") > 0
            ? "#prioridades"
            : `/usuarios/${usuario.id}/estatisticas`,
      },
    },
    atalhos: [
      { rotulo: "Minhas estatísticas", descricao: "Histórico por causa e recorrência", destino: `/usuarios/${usuario.id}/estatisticas`, icone: "≡" },
      { rotulo: "Abrir uma NC", descricao: "Registrar um fato para qualquer colaborador ativo", destino: "/abrir-nc", icone: "+" },
    ],
    tituloPrioridades: "O que precisa da sua atenção",
    vazioPrioridades: "Você não possui nenhuma NC ativa para acompanhar no momento.",
    tituloLista: "Minhas NCs e registros abertos por mim",
    cards: [
      {
        rotulo: "Minhas NCs ativas",
        valor: minhasNcs.filter((nc) => STATUS_ATIVOS.has(nc.status)).length,
        descricao: "NCs relacionadas a você",
        cor: "azul",
      },
      {
        rotulo: "Aguardando meu aceite",
        valor: contar(minhasNcs, "aguardando_aceite"),
        descricao: "Feedbacks para confirmar",
        cor: "amarela",
      },
      {
        rotulo: "Concluídas",
        valor: contar(minhasNcs, "concluida"),
        descricao: "Seus ciclos encerrados",
        cor: "verde",
      },
      {
        rotulo: "Abertas por mim",
        valor: abertasPorMim.length,
        descricao: "Registros que você iniciou",
        cor: "laranja",
      },
    ],
    prioridades: limitarPrioridades(prioridades),
  };
}

export function statusEhAtivo(status) {
  return STATUS_ATIVOS.has(status);
}
