export function mapearProfundidadeLiderados(supervisorId, pessoas) {
  const porLider = new Map();
  for (const pessoa of pessoas || []) {
    const liderId = pessoa.supervisor_id;
    if (!liderId) continue;
    const filhos = porLider.get(liderId) || [];
    filhos.push(pessoa);
    porLider.set(liderId, filhos);
  }

  const niveis = new Map();
  const visitados = new Set([supervisorId]);
  let fronteira = [supervisorId];
  let nivel = 1;
  while (fronteira.length) {
    const proxima = [];
    for (const liderId of fronteira) {
      for (const pessoa of porLider.get(liderId) || []) {
        if (!pessoa.id || visitados.has(pessoa.id)) continue;
        visitados.add(pessoa.id);
        niveis.set(pessoa.id, nivel);
        if (pessoa.papel === "supervisor") proxima.push(pessoa.id);
      }
    }
    fronteira = proxima;
    nivel += 1;
  }
  return niveis;
}
