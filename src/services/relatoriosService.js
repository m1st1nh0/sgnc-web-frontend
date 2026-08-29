import { baixarArquivoApi } from "./api.js";
import {
  montarQueryRelatorio,
  nomeArquivoRelatorio,
} from "./relatoriosQuery.js";

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
