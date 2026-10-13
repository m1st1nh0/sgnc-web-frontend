# Plano: aderência ao "Processo de Gestão de Não Conformidades"

Base: [`analise-processo-gestao-nc.md`](analise-processo-gestao-nc.md) (13/10/2026), que compara o documento da Qualidade (30/09/2026) com a produção. O plano segue as mesmas convenções do [retorno da diretoria](plano-retorno-diretoria-2909.md):

- uma fase por PR, validada no Preview;
- migrações aditivas;
- transições por RPC `*_vN` com `historico_nc`;
- a Qualidade nunca conduz NC em que é o colaborador analisado.

## Goal

> **O SGNC sustenta o ciclo completo do documento da Qualidade:**
> - toda NC de cobrança se apoia num procedimento publicado e numa origem registrada;
> - só NCs de cobrança com causa individual contam para reincidência e medidas;
> - a cada 3 NCs da mesma causa, o colaborador fica passível de medida, com a escada advertência → suspensão → avaliação de justa causa;
> - o feedback tem prazo por criticidade e registra participantes e posicionamento do colaborador;
> - a NC crítica tem contenção em 24 h e verificação de eficácia em 30 dias;
> - os indicadores de efetividade saem do sistema.

## Decisões do responsável (13/10/2026)

| # | Tema | Decisão |
|---|---|---|
| P1 | Criticidade | Continua **Baixa / Média / Alta**. "Crítica" segue como marcação separada, feita só depois da validação, como hoje. |
| P2 | Prazos | Adotar o **prazo de feedback** (5 dias úteis; 1 dia útil na NC crítica) e a **contenção em 24 h** na NC crítica. O prazo de 2 dias úteis para o aceite continua. |
| P3 | Gatilho da medida | Segue o documento: **a 3ª NC da mesma causa** deixa o colaborador passível de medida. O **contador zera** e uma nova sequência de 3 gera nova medida. Escada: as 3 primeiras medidas são advertências; depois vêm suspensões; completado esse ciclo, avalia-se a justa causa. O histórico é mantido. |
| P4 | RH | **Não há papel RH no sistema.** O sistema registra a situação da medida (passível, aplicada, alterada etc.). A aplicação é feita pelo RH, presencialmente. |
| P5 | Quem registra | **Qualquer perfil abre**; a Qualidade valida se procede ou não (como hoje). |
| P6 | Encerramento | A NC sem plano de ação encerra **no aceite** (como hoje). |
| P7 | Aviso ao supervisor | **Só na validação** (como hoje). |

## Perguntas em aberto

Precisam de resposta antes da fase indicada.

| # | Pergunta | Fase |
|---|---|---|
| Q1 | O ciclo de 3 NCs conta **dentro da janela de 12 meses** (como hoje) ou sem limite de tempo, só pelo "ciclo vigente"? | 1 |
| Q2 | A escada de medidas (3 advertências → suspensões → justa causa) é **por causa** (como hoje) ou **por colaborador**, somando todas as causas? | 1 |
| Q3 | As medidas já sugeridas pela regra antiga (4ª ocorrência) ficam como estão ou são recalculadas pela regra nova? | 1 |
| Q4 | Nomes das etapas da medida: "Sugerida" passa a "Passível de medida"? A confirmação pela Qualidade (aprovar ou reprovar) antes do registro "Aplicada" continua? "Alterada" é a troca do tipo, já existente? | 1 |
| Q5 | A NC crítica fica passível de medida **independentemente da contagem**, como no documento? | 1 |
| Q6 | Adotar a premissa do procedimento: a Qualidade informa na validação o procedimento descumprido e o link da intranet, e marca a NC como **cobrança** ou **orientativa**, que não conta para reincidência nem medida? Quem abre informa a origem (monitoria, auditoria, supervisão, indicador ou reclamação)? | 2 |
| Q7 | Causa **individual** ou **sistêmica**: a Qualidade marca no feedback? A NC sistêmica deixa de contar para reincidência e medidas, mas segue com aceite e plano? | 2 |
| Q8 | Prazo de feedback: conta a partir da validação (5 dias úteis) e, na crítica, a partir da marcação (1 dia útil)? Vencido, quem é avisado: a Qualidade e o líder? | 3 |
| Q9 | Contenção da NC crítica: a Qualidade registra o que foi feito (texto) em até 24 h corridas da marcação? Vencida, quem é avisado? | 3 |
| Q10 | Participantes do feedback: obrigatório escolher a Qualidade e o líder do colaborador, ou basta informar? | 4 |
| Q11 | A verificação de 30 dias vale só para a NC crítica (com plano de ação), já que as demais encerram no aceite? Na verificação não eficaz, a NC volta para "Reaberta" (novo plano) ou é "Escalada" para o responsável do departamento (gestor da área)? Quem decide entre as duas? | 5 |

## Fases

Ordem: 1 → 2 → 3 → 4 → 5 → 6 → 7. As fases 3 e 4 são independentes entre si.

### Fase 1: gatilho e escada da medida (P3, P4)

- [ ] 1.1 Migração: `medida_sugerida_para` passa a gerar medida a cada 3 ocorrências (3ª, 6ª, 9ª…), conforme Q1 e Q2.
- [ ] 1.2 Escada: 1ª a 3ª medida advertência, 4ª a 6ª suspensão, 7ª em diante avaliação de justa causa. A contagem segue Q2.
- [ ] 1.3 Tratamento das medidas existentes (Q3) e da NC crítica (Q5).
- [ ] 1.4 Interface e textos conforme Q4: o sistema registra a situação, e a aplicação é feita pelo RH, presencialmente.
- [ ] 1.5 Testes unitários da regra e cenário no Supabase em transação desfeita.

### Fase 2: procedimento, origem e tipo de causa (premissa, itens 2, 5.2 e 7 do documento)

- [ ] 2.1 Campos na NC: `origem` (abertura), `procedimento` e `procedimento_url` (validação), `tipo_nc` (`cobranca`/`orientativa`, na validação) e `natureza_causa` (`individual`/`sistemica`, no feedback), conforme Q6 e Q7.
- [ ] 2.2 Reincidência e medidas contam só NC de cobrança com causa individual. Antes de deixar o colaborador passível de medida, o sistema confere procedimento, evidência, causa individual e feedback registrado (item 7 do documento).
- [ ] 2.3 Telas de abertura, validação, detalhe e relatórios; CSV e PDF com os campos novos.

### Fase 3: prazos por criticidade (P2)

- [ ] 3.1 Prazo de feedback em horas de expediente: 5 dias úteis, e 1 dia útil na NC crítica, conforme Q8. Etapa e "Aguardando" mostram o prazo.
- [ ] 3.2 Contenção da NC crítica em até 24 h, conforme Q9: registro, prazo e aviso.
- [ ] 3.3 Notificações dos novos prazos pela matriz da Fase 5 do retorno da diretoria (lembretes só no expediente).

### Fase 4: feedback completo (item 5.2 e etapa 4 do documento)

- [ ] 4.1 Feedback registra participantes (Q10), posicionamento do colaborador (escuta) e resumo da conversa, além dos campos atuais.
- [ ] 4.2 Detalhe, PDF e CSV mostram os campos novos.

### Fase 5: verificação de eficácia (etapas 8 e 9 do documento)

- [ ] 5.1 Valores novos de status, em migração própria: `em_verificacao`, `reaberta` e `escalada`, conforme Q11.
- [ ] 5.2 Conclusão do plano abre a janela de 30 dias. Resultado eficaz ou não eficaz; nova NC da mesma causa na janela sugere "não eficaz".
- [ ] 5.3 RPCs de reabertura e escalonamento, com histórico e notificações.
- [ ] 5.4 Ação do plano vencida sem execução é sinalizada ao responsável do departamento (gestor da área).

### Fase 6: indicadores de efetividade (item 9 do documento)

- [ ] 6.1 Taxa de reincidência: colaboradores com nova NC da mesma causa ÷ colaboradores com NC no período.
- [ ] 6.2 Redução das ocorrências contra o período anterior, por causa.
- [ ] 6.3 Efetividade do feedback: feedbacks sem nova NC da mesma causa em 30 dias ÷ feedbacks aplicados.
- [ ] 6.4 Feedback no prazo da criticidade; planos de ação concluídos no prazo e eficazes.
- [ ] 6.5 NCs por natureza da causa (individual × sistêmica) e auditoria de completude dos registros (evidência, procedimento, feedback e verificação).

### Fase 7: UAT e revisão do documento

- [ ] 7.1 UAT nos três perfis, no computador e no celular.
- [ ] 7.2 Atualizar a análise de aderência e registrar a linha de base de 90 dias (item 10 do documento).
