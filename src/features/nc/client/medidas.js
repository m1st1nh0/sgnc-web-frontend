/** Apresentação das medidas disciplinares (tipos e etapas), compartilhada pelas telas. */
export const ROTULO_TIPO_MEDIDA = {
  advertencia: "Advertência",
  suspensao: "Suspensão",
  avaliar_justa_causa: "Avaliar justa causa/permanência",
};

export const SITUACAO_MEDIDA = {
  sugerida: { rotulo: "Sugerida", classe: "sg-badge--amarelo" },
  aprovada: { rotulo: "Aprovada, a aplicar", classe: "sg-badge--azul" },
  reprovada: { rotulo: "Reprovada", classe: "sg-badge--cinza" },
  aplicada: { rotulo: "Aplicada", classe: "sg-badge--vermelho" },
  cancelada: { rotulo: "Cancelada", classe: "sg-badge--cinza" },
};

export function situacaoDaMedida(status) {
  return SITUACAO_MEDIDA[status] ?? { rotulo: status || "-", classe: "sg-badge--cinza" };
}
