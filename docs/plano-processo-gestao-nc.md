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
| P2 | Prazos | Adotar o **prazo de feedback** (5 dias úteis; 1 dia útil na NC crítica) e a **contenção em 24 h** na NC crítica. O prazo de 2 dias úteis para o aceite continua. **Revista em 14/10** (adiada) e **retomada em 18/10:** entram os três prazos (análise de causa, feedback e contenção). |
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
| Q8 | ~~Prazos~~ **Respondida (18/10):** entram o prazo de análise de causa (2 dias úteis; crítica no mesmo dia), o prazo de feedback (5 dias úteis; crítica 1 dia útil) e a contenção. Vencido um prazo, é avisado o **líder direto de quem era responsável pela etapa**. | 3 |
| Q9 | ~~Contenção da NC crítica~~ **Respondida (18/10):** entra, com prazo de 24 h; vencida, segue a mesma regra de aviso da Q8. | 3 |
| Q10 | ~~Participantes do feedback~~ **Respondida (18/10):** escolhidos de uma lista limitada a quem tem relação com a NC (perfis da Qualidade, envolvidos e os gestores deles). Participantes **opcionais por enquanto** (revisto em 19/10: a empresa tem uma pessoa na Qualidade e o gestor ou outra pessoa pode acompanhar), escolhidos na lista de usuários ativos. Resumo da conversa obrigatório. Posicionamento do colaborador: a Qualidade decide se cabe e aciona um botão "+" que libera o campo para o próprio colaborador escrever. | 4 |
| Q11 | ~~Verificação de 30 dias~~ **Respondida (18/10):** vale só para NC com plano de ação. O resultado leva a NC ao status **Não eficaz**; dali a Qualidade decide se ela segue como **Reaberta** (novo plano) ou **Escalada** para revisão. | 5 |

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

**Retomada (18/10):** adiada em 14/10 e retomada em 18/10, com os três prazos (Q8, Q9 e N2).

- [x] 3.0 Análise de causa como etapa própria, antes do feedback (decisão de 19/10): a Qualidade registra a causa raiz, que o feedback reaproveita. Prazo de 2 dias úteis da validação; NC crítica, fim do dia útil da marcação.
- [x] 3.1 Prazo de feedback em horas de expediente: 5 dias úteis da validação; 1 dia útil da marcação na NC crítica. A trilha de etapas e o "Com quem está" mostram o prazo e o atraso.
- [x] 3.2 Contenção da NC crítica em até 24 h corridas da marcação. Responsável inicial: quem marcou; quem marcou (ou outra pessoa da Qualidade sem conflito) designa outra pessoa, que registra o que foi feito.
- [x] 3.3 Avisos: contenção designada → responsável; faltando 4 h → "urgente" ao responsável; vencido → "crítica" ao responsável e ao líder direto dele. Job próprio (`sgnc-prazos-etapas`), só no expediente.

**Decisões de 19/10:** análise de causa como etapa própria; prazos contados a partir da validação (NC crítica: da marcação), análise e feedback em horas de expediente e contenção em horas corridas; responsável pela análise e pelo feedback é quem validou; pela contenção, quem marcou ou quem ele designar.

**Status (19/10):** implementada no PR da Fase 3. Migração `20261019120000_prazos_analise_feedback_contencao.sql` (aditiva): colunas de prazo, análise e contenção; trigger que calcula os prazos na validação e na marcação; RPCs `registrar_analise_causa_v1`, `registrar_feedback_v5` (exige a análise e delega à v4), `designar_contencao_v1` e `registrar_contencao_v1`; job `prazos_etapas_v1`. NCs validadas antes da migração ficam sem prazo. Cenários conferidos no Postgres local: prazos na validação e na crítica, fim do dia útil (inclusive sexta à noite e fim de semana), feedback recusado sem análise, contenção designada e registrada (com recusa ao colaborador e a quem não tem relação), avisos de vencido ao responsável e ao líder, desmarcar a crítica volta aos prazos normais e o job não repete avisos. **Aplicada no Supabase em 19/10**, com autorização; os mesmos cenários foram repetidos lá em transação desfeita, sem deixar dados.

### Fase 4: feedback completo (item 5.2 e etapa 4 do documento)

- [x] 4.1 Feedback registra participantes (Q10, opcionais), resumo da conversa (obrigatório) e a liberação do posicionamento; o colaborador escreve o posicionamento no aceite, se quiser.
- [x] 4.2 Detalhe e PDF da NC mostram os campos novos. O CSV fica como está (formato simples fechado no plano de relatórios).
- [x] 4.3 Evidência obrigatória na validação (N3).
- [x] 4.4 Medida só é aprovada com o feedback da NC aplicado (N5); a reprovação continua possível.

**Status (19/10):** implementada no PR da Fase 4. Migração `20261019140000_feedback_completo.sql` (aditiva): colunas de resumo e posicionamento em `nc_feedbacks`, tabela `nc_feedback_participantes` e as RPCs `registrar_feedback_v6`, `aceitar_nc_v5`, `validar_nc_com_workflow_v5` e `decidir_medida_v2`, todas delegando às versões anteriores. Cenários conferidos no Postgres local: validação recusada sem evidência; feedback recusado sem resumo ou com participante inválido; posicionamento gravado no aceite só quando liberado (sem liberação, o aceite é recusado e a NC não muda); medida da 3ª NC recusada antes do feedback e aprovada depois. **Aplicada no Supabase em 19/10**, com autorização; os mesmos cenários foram repetidos lá em transação desfeita, sem deixar dados.

### Fase 5: verificação de eficácia (etapas 8 e 9 do documento)

- [x] 5.1 Valores novos de status, em migração própria: `em_verificacao`, `nao_eficaz`, `reaberta` e `escalada`.
- [x] 5.2 Conclusão do plano abre a janela de 30 dias ("Em verificação"). A Qualidade registra eficaz (NC concluída) ou não eficaz (com motivo); nova NC do colaborador com a mesma causa na janela gera aviso sugerindo "não eficaz"; no 30º dia a Qualidade é avisada.
- [x] 5.3 Não eficaz: a Qualidade reabre (nova rodada do plano, que volta à verificação) ou escala ao gestor do departamento do colaborador, que registra o parecer e encerra a NC. Histórico e avisos em cada passo.
- [x] 5.4 Ação do plano vencida sem execução: aviso ao responsável pela execução e ao líder direto dele.
- [x] 5.5 N1: plano de ação em NC não crítica, aberto pela Qualidade depois da validação e antes da conclusão.
- [x] 5.6 N4: desfecho da avaliação de justa causa (desligado ou mantido), só pela Qualidade.

**Decisões de 19/10:** janela de 30 dias a partir da conclusão do plano; a Qualidade registra o resultado (pode registrar antes do 30º dia); eficaz conclui; reaberta volta ao plano e à verificação; escalada vai ao gestor (responsável) do departamento do colaborador; plano em NC não crítica a qualquer momento depois da validação, se ela não estiver concluída; desfecho desligado ou mantido, só pela Qualidade; ação vencida avisa o responsável e o líder direto. Ideia registrada para depois: dar ao plano de ação uma estrutura própria (separada da NC).

**Status (19/10):** implementada no PR da Fase 5. Migrações `20261020110000_enum_verificacao_eficacia.sql` e `20261020120000_verificacao_eficacia.sql`. Cenários conferidos no Postgres local: plano aberto só depois da validação e só pela Qualidade sem conflito; aceite leva a NC com plano para "Em plano de ação"; marcar e desmarcar a crítica preserva o plano aberto; aviso de ação vencida ao responsável e ao líder; conclusão exige acompanhamento (na rodada reaberta, um novo); não eficaz exige motivo; reabrir inicia a rodada 2; nova NC da mesma causa conta como ocorrência e gera o alerta; escalar exige gestor no departamento e só ele registra o parecer; desfecho só uma vez. **Aplicadas no Supabase em 19/10**, com autorização; o fluxo completo (plano em NC leve, aceite, conclusão, não eficaz, reabertura, segunda rodada e escalada) foi repetido lá em transação desfeita, sem deixar dados.

### Fase 6: indicadores de efetividade (item 9 do documento)

- [ ] 6.1 Taxa de reincidência: colaboradores com nova NC da mesma causa ÷ colaboradores com NC no período.
- [ ] 6.2 Redução das ocorrências contra o período anterior, por causa.
- [ ] 6.3 Efetividade do feedback: feedbacks sem nova NC da mesma causa em 30 dias ÷ feedbacks aplicados.
- [ ] 6.4 Feedback no prazo da criticidade; planos de ação concluídos no prazo e eficazes.
- [ ] 6.5 Auditoria de completude dos registros (evidência, procedimento, feedback e verificação). O corte individual × sistêmica sai, porque não é campo (Q7).

## Perguntas novas da revisão (18/10)

| # | Pergunta | Resposta (18/10) | Fase |
|---|---|---|---|
| N1 | Plano de ação na NC leve | Separar a abertura do plano da marcação de crítica: qualquer NC validada pode ter plano; a crítica continua exigindo. | 5 |
| N2 | Prazo de análise de causa | Entra, junto com os demais prazos. | 3 |
| N3 | Evidência | Obrigatória na validação. | 4 |
| N4 | Desligamento | Registrar também o desfecho da avaliação de justa causa (desligado ou não). | 5 |
| N5 | Conferência antes da medida | A aprovação exige o feedback da NC já aplicado. | 4 |

## Revisão de aderência (18/10)

A [análise](analise-processo-gestao-nc.md) foi refeita depois das Fases 1 e 2: 37 de 65 itens atendidos (57%), contra 22 em 13/10. Ficaram as perguntas novas N1 a N5 (plano na NC leve, prazo de análise de causa, evidência obrigatória, desligamento e conferência antes da medida), além da Q10 e da Q11.

### Fase 7: UAT e revisão do documento

- [ ] 7.1 UAT nos três perfis, no computador e no celular.
- [ ] 7.2 Atualizar a análise de aderência e registrar a linha de base de 90 dias (item 10 do documento).
