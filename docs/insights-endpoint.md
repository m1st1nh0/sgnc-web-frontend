# Endpoint de Insights — `GET /insights`

Contrato combinado com o frontend para a página **Insights** (`/insights`).
Implementar na API FastAPI seguindo os padrões de autenticação existentes.

---

## 1. Autenticação e permissão

- Requer token Bearer (mesmo esquema das demais rotas).
- Liberado para papéis: **`adm`** e **`supervisor`**.

## 2. Parâmetros de consulta (opcionais)

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `inicio` | `YYYY-MM-DD` | Início do período analisado. Default: primeiro dia dos últimos 12 meses |
| `fim` | `YYYY-MM-DD` | Fim do período analisado (inclusivo). Default: hoje |

## 3. Resposta `200 OK`

```json
{
  "periodo": { "inicio": "2025-08-01", "fim": "2026-07-31" },

  "kpis": {
    "total_ncs": 120,
    "ncs_abertas": 10,
    "ncs_pendentes": 25,
    "ncs_concluidas": 70,
    "ncs_invalidadas": 15,
    "taxa_invalidacao": 0.125,
    "ncs_sem_chamado": 8
  },

  "ncs_por_mes": [
    { "mes": "2025-08", "total": 8, "concluidas": 5, "invalidadas": 1 }
  ],

  "ncs_por_status": [
    { "status": "aberta", "quantidade": 10 },
    { "status": "concluida", "quantidade": 70 }
  ],

  "ncs_por_colaborador": [
    {
      "colaborador_id": 3,
      "colaborador": "João Silva",
      "setor": "Produção",
      "total": 15,
      "invalidadas": 2,
      "reincidencias": 6
    }
  ],

  "ncs_por_setor": [
    { "setor": "Produção", "total": 40, "invalidadas": 5 }
  ],

  "ncs_por_criticidade": [
    { "criticidade": "Alta", "total": 30 },
    { "criticidade": "Média", "total": 50 },
    { "criticidade": "Baixa", "total": 40 }
  ],

  "ncs_por_causa": [
    {
      "causa_id": 7,
      "causa": "Falha de processo",
      "total": 35,
      "total_reincidentes": 8
    }
  ],

  "medidas_por_causa": [
    {
      "causa_id": 7,
      "causa": "Falha de processo",
      "advertencias": 4,
      "suspensoes": 2,
      "avaliacoes_justa_causa": 1,
      "total": 7
    }
  ],

  "reincidencia_por_causa": [
    {
      "causa_id": 7,
      "causa": "Falha de processo",
      "ocorrencias": 12,
      "reincidiu_apos_conclusao": 5
    }
  ]
}
```

## 4. Regras de contagem

- **Período**: todas as listas respeitam o filtro `inicio`/`fim` (usar a data da NC).
- **NC multi-causa**: uma NC com N causas conta em cada uma das causas
  (não fraciona). Por isso a soma de `ncs_por_causa.total` pode exceder
  `kpis.total_ncs`.
- **`ncs_pendentes`**: `validada` + `aguardando_analise` + `aguardando_aceite`.
- **`taxa_invalidacao`**: `ncs_invalidadas / total_ncs` (0 a 1), ou `null` se não houver NCs.
- **`ncs_por_mes`**: completo — todos os meses entre `inicio` e `fim` aparecem,
  inclusive os sem movimento (vêm com zero).
- **`ncs_sem_chamado`**: NCs com `chamado` nulo/vazio.
- **`ncs_por_colaborador[].reincidencias`**: NCs do colaborador cujo campo
  `reincidencia` é **`"Sim"`** (o campo é texto "Sim"/"Não", não um número).
- **`ncs_por_causa[].total_reincidentes`**: quantas NCs da causa possuem
  `reincidencia == "Sim"`.
- **`reincidencia_por_causa[].ocorrencias`**: total de ocorrências por causa
  no período (mesma lógica já usada nas estatísticas por usuário, agregada
  globalmente).
- **`reincidencia_por_causa[].reincidiu_apos_conclusao`**: NCs da causa, no
  período, abertas **depois** de uma NC anterior da mesma causa e do mesmo
  colaborador ter sido **concluída** — sinaliza ação corretiva que não
  resolveu. Se houver mais de uma NC concluída, considerar a mais recente
  anterior à abertura.
- **`medidas_por_causa`**: agregar as medidas disciplinares registradas
  (hoje aninhadas em `/usuarios/{id}/estatisticas`) agrupando pelo tipo:
  `advertencia`, `suspensao`, `avaliar_justa_causa`.

## 5. Campos de status aceitos

Reutilizar os mesmos valores já usados pela aplicação:
`aberta`, `invalidada`, `validada`, `aguardando_analise`,
`aguardando_aceite`, `concluida`.

## 6. Erros

| Código | Significado |
|---|---|
| `401` | Sem token / token inválido |
| `403` | Usuário sem permissão (papel ≠ adm/supervisor) |
| `422` | Parâmetros de data inválidos |