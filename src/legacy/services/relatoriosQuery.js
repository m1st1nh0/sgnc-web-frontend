function adicionar(params, chave, valor) {
  if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
    params.set(chave, String(valor).trim());
  }
}

export function montarQueryRelatorio(filtros = {}, { detalhado = false } = {}) {
  const params = new URLSearchParams();
  adicionar(params, "inicio", filtros.inicio);
  adicionar(params, "fim", filtros.fim);

  if (detalhado) {
    adicionar(params, "status", filtros.status);
    adicionar(params, "colaborador_id", filtros.colaboradorId);
    adicionar(params, "setor", filtros.setor);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function nomeArquivoRelatorio(tipo, filtros = {}) {
  const inicio = filtros.inicio || "inicio-padrao";
  const fim = filtros.fim || "hoje";
  if (tipo === "pdf") return `sgnc-resumo-${inicio}-${fim}.pdf`;
  return `sgnc-ncs-${inicio}-${fim}.csv`;
}
