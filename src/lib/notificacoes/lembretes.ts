/**
 * Espelho, em TypeScript, das regras de expediente e dos lembretes do aceite que rodam no banco
 * (somar_horas_expediente e lembretes_notificacoes_v1). Serve para testar os horários e para a
 * interface explicar quando cada aviso sobe de nível. O banco continua sendo a fonte de verdade.
 *
 * Expediente: segunda a sexta, 9h às 18h, America/Sao_Paulo (UTC-3 fixo, sem horário de verão desde 2019).
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const INICIO = 9;
const FIM = 18;

const paraLocal = (data: Date) => new Date(data.getTime() - OFFSET_MS);
const paraUtc = (local: Date) => new Date(local.getTime() + OFFSET_MS);
const diaSemana = (local: Date) => local.getUTCDay(); // 0 domingo … 6 sábado
const horaDecimal = (local: Date) => local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
const inicioDoDia = (local: Date, hora: number) =>
  new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hora));

export function dentroDoExpediente(agora: Date) {
  const local = paraLocal(agora);
  const dia = diaSemana(local);
  const hora = horaDecimal(local);
  return dia >= 1 && dia <= 5 && hora >= INICIO && hora < FIM;
}

/** Soma horas só dentro do expediente; fora dele, começa às 9h do próximo dia útil. */
export function somarHorasExpediente(inicio: Date, horas: number) {
  let local = paraLocal(inicio);
  let restanteMs = horas * HORA_MS;
  for (let guarda = 0; guarda < 1000; guarda += 1) {
    const dia = diaSemana(local);
    if (dia === 0 || dia === 6) { local = new Date(inicioDoDia(local, INICIO).getTime() + 24 * HORA_MS); continue; }
    const hora = horaDecimal(local);
    if (hora < INICIO) local = inicioDoDia(local, INICIO);
    else if (hora >= FIM) { local = new Date(inicioDoDia(local, INICIO).getTime() + 24 * HORA_MS); continue; }
    const fimDoDia = inicioDoDia(local, FIM);
    if (local.getTime() + restanteMs <= fimDoDia.getTime()) return paraUtc(new Date(local.getTime() + restanteMs));
    restanteMs -= fimDoDia.getTime() - local.getTime();
    local = new Date(inicioDoDia(local, INICIO).getTime() + 24 * HORA_MS);
  }
  throw new Error("Prazo fora do limite de cálculo.");
}

export type NivelLembrete = "atencao" | "urgente";

/**
 * Que lembrete o job das 15 em 15 min daria agora (null = nenhum):
 *  - fora do expediente ou prazo vencido: nenhum (o vencimento vira "Não respondida" no outro job);
 *  - urgente: faltam 4 horas de expediente ou menos, se ainda não estiver urgente/crítica;
 *  - atenção: a partir das 9h do dia útil seguinte ao envio, se ainda estiver "normal".
 */
export function lembreteAceite(agora: Date, registradoEm: Date, prazo: Date, nivelAtual: string = "normal"): NivelLembrete | null {
  if (!dentroDoExpediente(agora) || prazo.getTime() <= agora.getTime()) return null;
  if (somarHorasExpediente(agora, 4).getTime() >= prazo.getTime() && !["urgente", "critica"].includes(nivelAtual)) return "urgente";
  const dataLocal = (data: Date) => paraLocal(data).toISOString().slice(0, 10);
  if (dataLocal(agora) > dataLocal(registradoEm) && nivelAtual === "normal") return "atencao";
  return null;
}
