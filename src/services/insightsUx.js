const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function formatarMesInsights(rotulo) {
  const [ano, mes] = String(rotulo || "").split("-");
  if (!ano || !mes) return rotulo;
  return `${MESES_ABREV[Number(mes) - 1] ?? mes}/${String(ano).slice(-2)}`;
}

export function ordenarInsights(dados, chaveTotal = "total", limite = 10) {
  return [...(dados || [])]
    .filter((item) => Number(item?.[chaveTotal] ?? 0) > 0)
    .sort(
      (a, b) => Number(b?.[chaveTotal] ?? 0) - Number(a?.[chaveTotal] ?? 0)
    )
    .slice(0, limite);
}

export function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined || Number.isNaN(Number(segundos))) {
    return "—";
  }

  const total = Math.max(0, Math.round(Number(segundos)));
  if (total < 60) return `${total}s`;

  const minutosTotais = Math.floor(total / 60);
  if (minutosTotais < 60) return `${minutosTotais}min`;

  const horasTotais = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  if (horasTotais < 24) {
    return minutos ? `${horasTotais}h ${minutos}min` : `${horasTotais}h`;
  }

  const dias = Math.floor(horasTotais / 24);
  const horas = horasTotais % 24;
  return horas ? `${dias}d ${horas}h` : `${dias}d`;
}

export function descricaoTempo(resumo) {
  if (!resumo || !resumo.amostras) return "Sem amostras no período";
  return `Média ${formatarDuracao(resumo.media_segundos)} · ${resumo.amostras} amostra${
    resumo.amostras === 1 ? "" : "s"
  }`;
}

export function rotuloEscopo(escopo) {
  if (escopo?.tipo === "equipe_direta") {
    const quantidade = escopo.quantidade_colaboradores ?? 0;
    return `Equipe direta · ${quantidade} colaborador${quantidade === 1 ? "" : "es"}`;
  }
  return "Visão global da organização";
}

export function prepararAging(agedBacklog) {
  const ordem = ["0-1d", "2-3d", "4-7d", "8+d"];
  const porFaixa = new Map(
    (agedBacklog?.faixas || []).map((item) => [item.faixa, item.quantidade || 0])
  );
  return ordem.map((faixa) => ({
    faixa,
    quantidade: porFaixa.get(faixa) || 0,
  }));
}

export function prepararBacklogStatus(kpis = {}) {
  return [
    {
      status: "Aguardando avaliação",
      quantidade: kpis.abertas_atuais ?? 0,
    },
    {
      status: "Aguardando feedback",
      quantidade: kpis.aguardando_feedback_atual ?? 0,
    },
    {
      status: "Aguardando aceite",
      quantidade: kpis.aguardando_aceite_atual ?? 0,
    },
  ];
}

export function prepararReincidenciaCausa(dados) {
  return ordenarInsights(dados, "ocorrencias").map((item) => ({
    ...item,
    demais_ocorrencias: Math.max(
      0,
      Number(item.ocorrencias || 0) - Number(item.reincidencias_12m || 0)
    ),
  }));
}

export function prepararCausas(dados) {
  return ordenarInsights(dados).map((item) => ({
    ...item,
    nao_reincidentes: Math.max(
      0,
      Number(item.total || 0) - Number(item.total_reincidentes || 0)
    ),
  }));
}

export function prepararLinhaMensal(dados) {
  return (dados || []).map((item) => ({
    ...item,
    rotuloMes: formatarMesInsights(item.mes),
  }));
}

export function resumoMetodologia(dados) {
  return {
    periodo: dados?.periodo
      ? `${dados.periodo.inicio} a ${dados.periodo.fim}`
      : "Período padrão da API",
    volume:
      dados?.metodologia?.volume ||
      "Volume calculado pela data efetiva de abertura da NC.",
    backlog:
      dados?.metodologia?.backlog ||
      "Backlog representa a fotografia atual das NCs ativas.",
    tempos:
      dados?.metodologia?.tempos ||
      "Tempos são associados ao período pela transição final medida.",
  };
}
