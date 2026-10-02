import { baixarArquivoApi } from "../../../lib/api/client/api.js";
import { montarQueryRelatorio } from "./relatoriosQuery.js";

export { montarQueryRelatorio, nomeArquivoRelatorio } from "./relatoriosQuery.js";

export function baixarCsvNcs(filtros = {}) {
  return baixarArquivoApi(
    `/relatorios/ncs.csv${montarQueryRelatorio(filtros, { detalhado: true })}`
  );
}

export function baixarPdfResumo(filtros = {}) {
  return baixarArquivoApi(
    `/relatorios/resumo.pdf${montarQueryRelatorio(filtros)}`
  );
}

export function baixarPdfDossie(usuarioId) {
  return baixarArquivoApi(
    `/relatorios/usuarios/${encodeURIComponent(usuarioId)}/dossie.pdf`
  );
}

export function baixarPdfNc(ncId) {
  return baixarArquivoApi(`/relatorios/nc/${encodeURIComponent(ncId)}.pdf`);
}
