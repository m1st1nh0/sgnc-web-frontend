/**
 * Utilitários de formatação compartilhados pela aplicação.
 */

/**
 * Formata uma data ISO (YYYY-MM-DD) para o padrão brasileiro (DD/MM/YYYY).
 * Se a entrada não estiver no formato esperado, devolve o valor original.
 */
export function formatarData(data) {
  if (!data) return "-";
  const partes = String(data).split("-");
  if (partes.length !== 3) return data;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata uma data/hora ISO (com timestamp) para DD/MM/AAAA HH:mm.
 * Se a entrada não puder ser interpretada, devolve "-".
 */
export function formatarDataHora(dataIso) {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}
