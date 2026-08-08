const CORES_CRITICIDADE = {
    baixa: "sg-badge--verde",
    média: "sg-badge--amarelo",
    media: "sg-badge--amarelo",
    alta: "sg-badge--vermelho",
};

/**
 * Badge de criticidade/prioridade de uma Não Conformidade.
 *
 * Props:
 *  - criticidade: string (ex: "Baixa", "Média", "Alta")
 */
export default function BadgePrioridade({ criticidade }) {
    const chave = String(criticidade || "").toLowerCase();
    const classe = CORES_CRITICIDADE[chave] ?? "sg-badge--cinza";

    return <span className={`sg-badge ${classe}`}>{criticidade || "-"}</span>;
}