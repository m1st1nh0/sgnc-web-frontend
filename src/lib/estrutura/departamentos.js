/**
 * Verdadeiro quando colocar `departamentoId` dentro de `novoPaiId` criaria um ciclo,
 * isto é, quando a nova área-mãe é o próprio departamento ou está abaixo dele.
 */
export function temCicloDepartamento(departamentos, departamentoId, novoPaiId) {
  const paiDe = new Map((departamentos || []).map((item) => [item.id, item.departamento_pai_id]));
  const vistos = new Set();
  let atual = novoPaiId;
  while (atual && !vistos.has(atual)) {
    if (atual === departamentoId) return true;
    vistos.add(atual);
    atual = paiDe.get(atual) ?? null;
  }
  return false;
}

/** Nome completo da área, do topo até ela (ex.: "Inteligência › Qualidade"). */
export function caminhoDepartamento(departamentos, departamentoId) {
  const porId = new Map((departamentos || []).map((item) => [item.id, item]));
  const nomes = [];
  const vistos = new Set();
  let atual = porId.get(departamentoId);
  while (atual && !vistos.has(atual.id)) {
    nomes.unshift(atual.nome);
    vistos.add(atual.id);
    atual = porId.get(atual.departamento_pai_id);
  }
  return nomes.join(" › ");
}
