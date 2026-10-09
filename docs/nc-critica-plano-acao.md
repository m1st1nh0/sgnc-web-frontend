# NC crítica e plano de ação

## Fluxo

```
aberta ──validar──▶ aguardando_feedback ──feedback──▶ aguardando_aceite ──aceite──▶ concluida
                         │  (Qualidade marca crítica a partir daqui)               │
                         ▼                                                         ▼
                   plano aberto (planejamento → execução → acompanhamento)   em_plano_acao
                                                                                   │ Qualidade verifica a eficácia
                                                                                   ▼
                                                                               concluida
```

- A NC só pode ser marcada como crítica **depois de validada** (uma NC em triagem ainda pode ser invalidada).
- Ao marcar, o plano de ação é aberto imediatamente, então o planejamento começa sem esperar o aceite.
- O feedback e o aceite formal do colaborador continuam iguais. Depois do aceite, a NC crítica vai para
  **`em_plano_acao`**, e não para `concluida`. Se a NC já estava concluída, ela entra em `em_plano_acao` na hora.
- O plano só é concluído pela verificação de eficácia, que leva a NC para `concluida`.
- Remover a criticidade exige justificativa, **cancela** o plano (não apaga nada) e devolve uma NC `em_plano_acao` para `concluida`.
  Se a NC for marcada de novo, o mesmo plano é reaberto com o que já estava registrado.

## Quem pode o quê

| Ação | Qualidade (adm) | Liderança do colaborador | Colaborador analisado | Quem só registrou a NC |
|---|---|---|---|---|
| Marcar ou remover a criticidade | ✅ | ❌ | ❌ | ❌ |
| Alimentar o plano (planejamento, execução, acompanhamento) | ✅ | ✅ | ❌ | ❌ |
| Verificar a eficácia e concluir o plano | ✅ ¹ | ❌ | ❌ | ❌ |
| Ver o plano | ✅ | ✅ | ✅ (somente leitura) | ❌ |

¹ Quem consta como responsável pela execução não pode verificar a eficácia.

**Conflito de interesses:** quem é o colaborador analisado (objeto da NC) **nunca** age sobre a própria NC,
mesmo que tenha o papel de Qualidade ou de liderança. Isso vale para avaliar (validar ou invalidar), dar feedback,
editar, excluir, registrar medida disciplinar, remover evidências e para todas as ações do plano.
"Liderança" é qualquer supervisor acima do colaborador na hierarquia (direto ou indireto), e não qualquer supervisor.

## Auditoria

- Cada alteração no plano gera um evento automático que lista os campos alterados. Os registros de
  acompanhamento só aceitam inclusão: nem o `service_role` tem permissão de `UPDATE` ou `DELETE` na tabela.
- Marcar ou remover a criticidade, o aceite e a conclusão também ficam em `historico_nc`.
- Uma NC com plano de ação não pode ser excluída. O banco usa `ON DELETE RESTRICT`, e a API retorna 409.

## Defesa em profundidade

As regras ficam em `src/lib/permissions/plano-acao.ts` (cobertas por testes unitários) e se repetem nas funções
SQL (`definir_nc_critica_v1`, `salvar_plano_acao_v1`, `registrar_acompanhamento_plano_v1`,
`concluir_plano_acao_v1` e nas RPCs v3 de validação, invalidação e feedback). Assim, uma chamada direta com a
service role também não consegue contornar a segregação.

## Implantação

Aplique as migrações nesta ordem (o novo valor do enum precisa de commit antes de ser usado):

1. `20261008120000_status_em_plano_acao.sql`
2. `20261008121000_nc_critica_plano_acao.sql`
