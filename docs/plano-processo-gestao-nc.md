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
| Q1 | ~~Janela de contagem~~ **Respondida (13/10):** ciclo de 12 meses contado a partir da 1ª NC da causa. Fechada a janela, tudo zera (contador e escada); a NC seguinte abre um ciclo novo. | 1 |
| Q2 | ~~Escada~~ **Respondida (13/10):** por causa, como prevê a lei trabalhista. | 1 |
| Q3 | ~~Medidas antigas~~ **Respondida (13/10):** recalcular; a base atual é de teste e será limpa antes da produção. | 1 |
| Q4 | ~~Nomes~~ **Respondida (13/10):** "Sugerida" passa a se chamar "Passível de medida" na interface. A Qualidade continua aprovando ou reprovando; "Alterada" é a troca do tipo, já existente; o cancelamento continua. | 1 |
| Q5 | ~~NC crítica~~ **Respondida (13/10):** fica passível de medida independentemente da contagem, ainda com aprovação ou reprovação pela Qualidade. | 1 |
| Q6 | ~~Procedimento, tipo e origem~~ **Respondida (14/10):** na validação, a Qualidade informa a **origem** (monitoria, auditoria, supervisão, indicador ou reclamação), **obrigatória**; quem abre a NC não informa. Procedimento e link da intranet são **opcionais**. A Qualidade marca **cobrança** ou **orientativa**; a orientativa não conta para reincidência nem medida. | 2 |
| Q7 | ~~Individual ou sistêmica~~ **Respondida (14/10):** não vira regra nem campo. Só se identifica depois de investigação e conversa; fica como observação no feedback. | 2 |
| Q8 | Prazo de feedback: conta a partir da validação (5 dias úteis) e, na crítica, a partir da marcação (1 dia útil)? Vencido, quem é avisado: a Qualidade e o líder? | 3 |
| Q9 | Contenção da NC crítica: a Qualidade registra o que foi feito (texto) em até 24 h corridas da marcação? Vencida, quem é avisado? | 3 |
| Q10 | Participantes do feedback: obrigatório escolher a Qualidade e o líder do colaborador, ou basta informar? | 4 |
| Q11 | A verificação de 30 dias vale só para a NC crítica (com plano de ação), já que as demais encerram no aceite? Na verificação não eficaz, a NC volta para "Reaberta" (novo plano) ou é "Escalada" para o responsável do departamento (gestor da área)? Quem decide entre as duas? | 5 |

## Fases

Ordem: 1 → 2 → 3 → 4 → 5 → 6 → 7. As fases 3 e 4 são independentes entre si.

### Fase 1: gatilho e escada da medida (P3, P4)

- [x] 1.1 Migração: `medida_sugerida_para` passa a gerar medida a cada 3 ocorrências (3ª, 6ª, 9ª…), conforme Q1 e Q2.
- [x] 1.2 Escada: 1ª a 3ª medida advertência, 4ª a 6ª suspensão, 7ª em diante avaliação de justa causa. A contagem segue Q2.
- [x] 1.3 Tratamento das medidas existentes (Q3) e da NC crítica (Q5).
- [x] 1.4 Interface e textos conforme Q4: o sistema registra a situação, e a aplicação é feita pelo RH, presencialmente.
- [x] 1.5 Testes unitários da regra e cenário no Supabase em transação desfeita.

**Decisões de 14/10:**
- Só sobem a escada as medidas aprovadas pela Qualidade (aprovadas ou aplicadas). Uma medida passível ainda sem decisão não conta.
- A contagem é por causa. A NC com duas causas conta +1 em cada uma, e cada causa pode gerar a sua medida.
- A NC crítica gera medida para cada causa dela.
- Na 3ª, 6ª… NC, se ela também for crítica, sai uma única medida, que registra as duas origens (`reincidencia_e_critica`).

**Status (14/10):** migração aplicada no Supabase com autorização. O recálculo da base de teste gerou duas medidas passíveis: a da 3ª NC da causa (NC #11) e a da NC crítica (NC #17); a medida já aplicada continua no histórico. Cenários repetidos no Supabase em transação desfeita:
- com só a 1ª medida aprovada, a 2ª e a 3ª continuam advertência;
- a NC com duas causas conta para as duas;
- marcar como crítica uma NC que já gerou medida pela contagem junta as duas origens na mesma medida;
- a outra causa da mesma NC ganha a sua medida.

**Status (13/10):** implementada no PR da Fase 1. Migração `20261013120000_medida_ciclo_tres_ncs.sql`:
- `ocorrencia_no_ciclo` faz a contagem no ciclo e `proxima_medida_do_ciclo` define a escada da causa, sem contar as medidas reprovadas e canceladas.
- `medida_para_nc_critica` e o trigger `medida_ao_marcar_critica` deixam o colaborador passível de medida na NC crítica, com uma medida por NC.
- O CHECK do gatilho passou de `>= 4` para `>= 1`.
- Na coluna `origem`, a medida fica como `reincidencia` ou `nc_critica`.
- O aviso diz "Colaborador passível de medida".
- O recálculo da base cancela as pendências da regra antiga, sem disparar avisos.

O servidor deixou de recalcular a medida em TypeScript: o painel de feedback e os Insights leem a medida gerada pelo banco. Cenários conferidos no Postgres local:
- medidas na 3ª, 6ª e 9ª NC;
- a medida reprovada sai da escada;
- 1ª a 3ª medida do ciclo: advertência; 4ª a 6ª: suspensão; 7ª em diante: avaliação de justa causa;
- o ciclo zera depois de 12 meses;
- a NC crítica gera medida fora da contagem e não duplica a medida que a contagem já gerou.

### Fase 2: procedimento, origem e tipo de causa (premissa, itens 2, 5.2 e 7 do documento)

- [x] 2.1 Campos na NC: `origem` (obrigatória na validação), `tipo_nc` (`cobranca`/`orientativa`, padrão `cobranca`), `procedimento` e `procedimento_url` (opcionais, link só `http(s)://`), com CHECK no banco. Sem campo de causa individual × sistêmica (Q7).
- [x] 2.2 `validar_nc_com_workflow_v4` grava a classificação e valida na mesma transação (só grava depois de conferir conflito de interesse, status e colaborador). NC orientativa não conta para reincidência (`ocorrencia_numero` nulo) nem gera medida, nem quando é crítica. A conferência pré-medida do item 7 do documento não entra, porque procedimento é opcional e individual × sistêmica não é regra.
- [x] 2.3 Tela de validação com origem, tipo, procedimento e link; o detalhe e o PDF da NC mostram a classificação; o painel de feedback mostra "não conta (NC orientativa)". CSV e Excel ficam como estão (formato fechado no plano de relatórios).

**Status (14/10):** implementada no PR da Fase 2. Migração `20261014120000_classificacao_na_validacao.sql` aplicada no Supabase em 14/10, com autorização; os mesmos cenários foram repetidos lá em transação desfeita. Cenários conferidos no Postgres local:
- cobrança conta e a orientativa é pulada (cobrança, orientativa, cobrança, cobrança → 1ª, —, 2ª, 3ª com medida);
- orientativa crítica não gera medida;
- validação sem origem, com tipo ou link inválido, ou pela Qualidade acusada é recusada sem gravar nada;
- a validação gera uma entrada no histórico.

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
