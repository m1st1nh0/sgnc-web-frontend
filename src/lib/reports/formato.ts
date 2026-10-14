/** Formatação dos relatórios (PDF e planilha): tudo no vocabulário das telas e no horário de Brasília. */
import { ROTULO_TIPO_MEDIDA, situacaoDaMedida } from "@/features/nc/client/medidas.js";

const FUSO = "America/Sao_Paulo";

/** Nome do status como aparece na tela de relatórios. Status legados caem no equivalente atual. */
export const ROTULO_STATUS: Record<string, string> = {
  aberta: "Aguardando avaliação",
  aguardando_feedback: "Aguardando feedback",
  validada: "Aguardando feedback",
  aguardando_analise: "Aguardando feedback",
  aguardando_aceite: "Aguardando aceite",
  nao_respondida: "Não respondida",
  em_plano_acao: "Em plano de ação",
  concluida: "Concluída",
  invalidada: "Invalidada",
};

export const rotuloStatus = (status: unknown) => ROTULO_STATUS[String(status ?? "")] ?? String(status ?? "-");

/** Situação do aceite; NC sem feedback fica em branco. */
export const ROTULO_ACEITE: Record<string, string> = {
  aguardando: "Aguardando aceite",
  no_prazo: "Aceito no prazo",
  fora_prazo: "Aceito fora do prazo",
  nao_respondida: "Não respondida",
  sem_feedback: "",
};

export const rotuloTipoMedida = (tipo: unknown) =>
  (ROTULO_TIPO_MEDIDA as Record<string, string>)[String(tipo ?? "")] ?? String(tipo ?? "-");
export const rotuloSituacaoMedida = (status: unknown) => situacaoDaMedida(status).rotulo as string;

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function partes(valor: unknown, comHora: boolean) {
  const data = new Date(String(valor));
  if (Number.isNaN(data.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric",
    ...(comHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(data).map((parte) => [parte.type, parte.value]));
}

/** dd/mm/aaaa. Data pura (aaaa-mm-dd) não passa por fuso; timestamp é convertido para Brasília. */
export function dataBr(valor: unknown, vazio = "-") {
  if (valor == null || valor === "") return vazio;
  const texto = String(valor);
  if (SO_DATA.test(texto)) return texto.split("-").reverse().join("/");
  const p = partes(texto, false);
  return p ? `${p.day}/${p.month}/${p.year}` : vazio;
}

/** dd/mm/aaaa hh:mm no horário de Brasília. */
export function dataHoraBr(valor: unknown, vazio = "-") {
  if (valor == null || valor === "") return vazio;
  const p = partes(valor, true);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : vazio;
}

export const periodoBr = (inicio: unknown, fim: unknown) => `${dataBr(inicio)} a ${dataBr(fim)}`;

export const plural = (quantidade: number, singular: string, pluralForma = `${singular}s`) =>
  `${quantidade} ${quantidade === 1 ? singular : pluralForma}`;

/** Duração como se fala: "menos de 1 min", "11 min", "2 h 05 min", "3 d 4 h". */
export function duracao(segundos: number | null | undefined, vazio = "-") {
  if (segundos == null || !Number.isFinite(segundos)) return vazio;
  const minutos = Math.floor(Math.max(0, segundos) / 60);
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return minutos % 60 ? `${horas} h ${String(minutos % 60).padStart(2, "0")} min` : `${horas} h`;
  const dias = Math.floor(horas / 24);
  return horas % 24 ? `${dias} d ${horas % 24} h` : `${dias} d`;
}
