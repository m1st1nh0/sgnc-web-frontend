# Aderência do SGNC ao "Processo de Gestão de Não Conformidades"

Comparação entre o documento da Qualidade (atualizado em 30/09/2026) e o `main`.

- **Revisão de 18/10/2026:** depois das Fases 1 (gatilho e escada da medida) e 2 (classificação na validação) do [plano do processo](plano-processo-gestao-nc.md), do comprovante assinado na aplicação da medida (PR #66) e das decisões de 13 e 14/10.
- **Primeira versão:** 13/10/2026 (`7f94746`), com 22 itens atendidos, 16 parciais e 27 não atendidos.

Legenda:
- ✅ atendido;
- ☑️ atendido na forma decidida pelo responsável (adaptação registrada no plano);
- 🟡 parcial;
- ❌ não atendido;
- ⏸️ adiado por decisão (Fase 3);
- ➖ não se aplica, por decisão.

## Resumo

| Seção do documento | ✅ | ☑️ | 🟡 | ❌ | ⏸️ / ➖ |
|---|---|---|---|---|---|
| 2. Premissa (procedimento, NC Orientativa) | 1 | 1 | 0 | 0 | 0 |
| 3. Papéis | 2 | 1 | 2 | 0 | 0 |
| 4. Criticidade | 2 | 1 | 2 | 0 | 2 |
| 5.2 Informações do registro | 9 | 1 | 1 | 0 | 0 |
| 5.2 Informações das etapas seguintes | 4 | 0 | 3 | 3 | 0 |
| 6. Fluxo e status | 1 | 3 | 2 | 5 | 0 |
| 7. Reincidência e medidas | 6 | 2 | 1 | 0 | 0 |
| 9. Indicadores | 3 | 0 | 2 | 2 | 2 |
| 10. Avaliação do processo | 0 | 0 | 0 | 1 | 0 |
| **Total (65 itens)** | **28** | **9** | **13** | **11** | **4** |

**Atendidos (✅ + ☑️): 37 de 65 (57%)**, contra 22 (34%) em 13/10. Não atendidos caíram de 27 para 11.

O que fechou desde 13/10:
- **Premissa:** a validação registra origem (obrigatória), procedimento e link da intranet (opcionais) e o tipo cobrança ou orientativa. A orientativa não conta para reincidência nem para medida.
- **Medidas:** a 3ª NC da mesma causa deixa o colaborador passível de medida, num ciclo de 12 meses por causa, com escada advertência → suspensão → justa causa. A NC crítica fica passível de medida independentemente da contagem.
- **RH:** o sistema registra a medida e o RH aplica presencialmente. A aplicação passa a exigir a foto do comprovante assinado (preparação aplicada; a ativação global ainda não foi aplicada, ver [`medida-comprovante-assinado.md`](medida-comprovante-assinado.md)).

O que falta, por frente:
1. **Feedback completo (Fase 4):** participantes, posicionamento do colaborador, resumo da conversa e feedback conjunto com o gestor. 4 itens.
2. **Verificação de eficácia (Fase 5):** status "Em verificação", "Reaberta" e "Escalada", resultado eficaz ou não eficaz, escalonamento, encerramento da crítica depois da verificação e ação vencida avisada ao gestor da área. 8 itens.
3. **Indicadores (Fase 6):** taxa de reincidência pela fórmula do documento, redução por causa, efetividade do feedback, eficácia dos planos e auditoria de completude. 5 itens.
4. **Sem fase no plano (perguntas novas, abaixo):** plano de ação opcional na NC leve, prazo de análise de causa, evidência obrigatória, fluxo de desligamento e conferência antes da medida.

## Detalhe por seção

### 2. Abrangência e premissa

| Requisito | Situação | Observação |
|---|---|---|
| Cobrança só sobre procedimento documentado e publicado na intranet | ☑️ | Campos `procedimento` e `procedimento_url` na validação. Opcionais por decisão (Q6). |
| Sem procedimento, segue como **NC Orientativa**, sem contar para progressão | ✅ | `tipo_nc = orientativa`: não conta para reincidência nem medida, nem quando é crítica. A Qualidade escolhe o tipo; o sistema não deriva da ausência de procedimento. |

### 3. Papéis

| Papel | Situação | Observação |
|---|---|---|
| Analista de Qualidade conduz todas as etapas | ✅ | Papel `qualidade` (e `adm`). A segregação impede conduzir a própria NC. |
| Supervisor participa e acompanha | ✅ | Hierarquia por liderança, visão da equipe e notificações. |
| Gestores da área analisam indicadores e decidem em causa sistêmica | 🟡 | Departamentos e cargos existem, mas não há visão nem decisão própria de "gestor da área". Causa sistêmica virou observação (Q7). Depende da Q11 (escalonamento). |
| RH aplica medidas disciplinares | ☑️ | Sem papel RH (P4): o sistema registra; o RH aplica presencialmente, com foto do comprovante assinado. |
| Diretoria formaliza desligamento junto ao RH | 🟡 | A Diretoria recebe aviso de NC crítica; não há registro de desligamento. A 7ª medida sugere "avaliação de justa causa". Ver pergunta N4. |

### 4. Classificação de criticidade

| Requisito | Situação | Observação |
|---|---|---|
| Duas classes: Leve e Crítica | ☑️ | Baixa/Média/Alta, com a marcação separada "NC crítica" depois da validação (P1). |
| Contenção imediata obrigatória em até 24 h (crítica) | ⏸️ | Fase 3 adiada (14/10). |
| Comunicação: leve avisa o supervisor; crítica avisa supervisor e gestores no mesmo dia | ✅ | Líder direto; na crítica, a cadeia até a Diretoria. |
| Prazo para feedback: 5 dias úteis (leve) e 1 dia útil (crítica) | ⏸️ | Fase 3 adiada (14/10). |
| Plano de ação opcional na leve e obrigatório na crítica | 🟡 | Obrigatório na crítica; a leve não tem como abrir plano. Ver pergunta N1. |
| Encerramento: leve após feedback; crítica após verificação de eficácia | 🟡 | A leve encerra no aceite (P6, ☑️). A crítica encerra na conclusão do plano, sem a janela de 30 dias (Fase 5). |
| NC crítica vai ao RH para medida independentemente da contagem | ✅ | Passível de medida em cada causa, com aprovação da Qualidade (Fase 1). |

### 5.2 Informações obrigatórias: registro

| Campo | Situação |
|---|---|
| Número da NC gerado pelo sistema | ✅ |
| Colaborador | ✅ |
| Área/equipe | ✅ (`setor`, departamento) |
| Gestor responsável | ✅ (derivado da liderança) |
| Data da ocorrência e do registro | ✅ |
| Origem (monitoria, auditoria, supervisão, indicador, reclamação) | ✅ (obrigatória na validação) |
| Procedimento descumprido com link da intranet | ☑️ (opcional por decisão) |
| Tipo/causa | ✅ (catálogo fechado; tipo cobrança ou orientativa) |
| Descrição objetiva | ✅ |
| Evidências anexadas | 🟡 (opcionais; o documento pressupõe que existam. Ver pergunta N3) |
| Criticidade e responsável pelo registro | ✅ |

### 5.2 Informações obrigatórias: etapas seguintes

| Campo | Situação | Observação |
|---|---|---|
| Data do feedback | ✅ | |
| Participantes do feedback | ❌ | Fica registrado só quem lançou. Fase 4 (Q10). |
| Resumo da conversa | 🟡 | O campo "combinado" faz esse papel em parte. Fase 4. |
| Posicionamento do colaborador (escuta) | ❌ | Fase 4. |
| Ação esperada | ✅ | "Ação combinada". |
| Ciência | ✅ | Aceite com a frase digitada e prazo de 2 dias úteis. |
| Plano de ação: ação, responsável e prazo | 🟡 | O feedback tem ação, responsável e prazo; o plano completo só existe na crítica (N1). |
| Registros de acompanhamento | ✅ | No plano de ação. |
| Resultado da verificação: eficaz ou não eficaz | 🟡 | Texto livre de "verificação de eficácia", sem resultado binário. Fase 5. |
| Data de encerramento ou escalonamento | ❌ | Há data de encerramento; não há escalonamento. Fase 5. |

### 6. Fluxo e status

| Requisito | Situação | Observação |
|---|---|---|
| Identificação por supervisor ou outra área, repassada à Qualidade | ✅ | Qualquer perfil abre; a Qualidade valida. |
| Registro feito pelo Analista no ato | ☑️ | Qualquer perfil abre e a Qualidade valida (P5); equivale ao "repasse". |
| Validação: evidência suficiente e existência de procedimento | ☑️ | Valida ou invalida com motivo; procedimento opcional (Q6). |
| Supervisor notificado no registro | ☑️ | Avisado na validação (P7). |
| Análise de causa em até 2 dias úteis (crítica: no mesmo dia) | ❌ | Sem prazo nem etapa própria; a causa raiz entra com o feedback. Ver pergunta N2. |
| Feedback conjunto Analista + Gestor | ❌ | Fase 4 (Q10). |
| Status do documento: Aberta, Feedback pendente, Em ação, Em verificação, Encerrada, Reaberta e Escalada | 🟡 | Aberta, Aguardando feedback, Aguardando aceite, Não respondida, Em plano de ação, Concluída e Invalidada. Faltam os três abaixo. |
| Status "Em verificação" com janela de 30 dias | ❌ | Fase 5 (Q11). |
| "Reaberta" quando a verificação não é eficaz | ❌ | Fase 5 (Q11). |
| "Escalada" para RH ou gestores da área | ❌ | Fase 5 (Q11). |
| Ações vencidas sinalizadas aos gestores da área | 🟡 | O responsável é avisado antes do prazo (`prazo_acao`); depois do vencimento, o gestor da área não é avisado. Fase 5. |

### 7. Reincidência e medidas disciplinares

| Requisito | Situação | Observação |
|---|---|---|
| Contador automático por causa | ✅ | `ocorrencia_numero`, por colaborador e causa. |
| Só NCs de cobrança com causa individual contam | ☑️ | Só a cobrança conta. Individual × sistêmica fica como observação no feedback (Q7). |
| 3 NCs da mesma causa geram medida | ✅ | 3ª, 6ª, 9ª… NC da causa no ciclo. |
| Contador zerado depois da medida, com histórico mantido | ✅ | Nova medida a cada 3; ciclo de 12 meses desde a 1ª NC da causa, depois zera (Q1). Histórico mantido. |
| 3 medidas levam a suspensão; 3 suspensões, a desligamento | ✅ | Por causa: 1ª a 3ª advertência, 4ª a 6ª suspensão, 7ª em diante avaliação de justa causa; só sobem a escada as aprovadas. |
| Medida em etapas, com segregação | ✅ | Passível, aprovada ou reprovada, aplicada; quem é o colaborador não decide nem aplica. |
| RH executa a medida | ☑️ | Presencialmente, fora do sistema; o registro exige foto assinada. |
| Antes de encaminhar, conferir procedimento, evidência, causa individual e feedback | 🟡 | A Qualidade aprova ou reprova cada medida, mas o sistema não exige o feedback aplicado antes da aprovação. Ver pergunta N5. |
| NC crítica vai ao RH independentemente da contagem | ✅ | |

### 9. Indicadores

| Indicador | Situação | Observação |
|---|---|---|
| Volume por área, causa e criticidade | ✅ | Insights e Relatórios. |
| NCs por causa | ✅ | |
| Medidas disciplinares | ✅ | |
| Taxa de reincidência (reincidentes ÷ colaboradores com NC) | 🟡 | Há reincidentes por causa e por colaborador, não a taxa nessa fórmula. Fase 6. |
| Redução das ocorrências contra o período anterior | 🟡 | O resumo em PDF compara o total com o período anterior; falta o corte por causa. Fase 6. |
| Efetividade do feedback (sem nova NC da mesma causa em 30 dias) | ❌ | Fase 6. |
| Feedback no prazo da criticidade | ⏸️ | Depende do prazo de feedback (Fase 3 adiada). Hoje existe "aceite no prazo". |
| Planos concluídos no prazo e eficazes | ❌ | Fase 6, depois da Fase 5. |
| Causas sistêmicas identificadas e corrigidas | ➖ | Individual × sistêmica não é campo (Q7). |

### 10. Avaliação do processo

| Requisito | Situação | Observação |
|---|---|---|
| Linha de base de 90 dias e auditoria amostral da completude dos registros | ❌ | Fase 6 (auditoria de completude) e Fase 7 (linha de base). |

## Perguntas novas (revisão de 18/10)

Itens do documento que o plano ainda não cobre:

| # | Pergunta | Fase sugerida |
|---|---|---|
| N1 | Plano de ação na NC leve: a Qualidade pode abrir um plano opcional na NC não crítica (o documento prevê), ou a leve continua só com a ação combinada do feedback? | 5 |
| N2 | Prazo de análise de causa (2 dias úteis; crítica no mesmo dia): fica adiado junto com a Fase 3, já que a causa raiz entra com o feedback? | 3 (adiada) |
| N3 | Evidência: continua opcional, ou passa a ser obrigatória na validação da NC de cobrança? | 4 |
| N4 | Desligamento: basta o sistema registrar a medida de "avaliação de justa causa" (aplicação pelo RH com a Diretoria, fora do sistema), ou é preciso registrar o desfecho (desligado ou não)? | 5 |
| N5 | Conferência antes da medida: a aprovação da medida deve exigir que o feedback da NC já tenha sido aplicado? | 4 |

**Respostas (18/10):**
- N1: separar a abertura do plano de ação da marcação de crítica. Qualquer NC validada pode ter plano; a crítica continua exigindo plano.
- N3: evidência obrigatória na validação.
- N5: a aprovação da medida exige o feedback da NC já aplicado.
- N2: os prazos entram (Fase 3 retomada).
- N4: registrar também o desfecho (desligado ou não).

Q10 e Q11 foram respondidas e estão no plano.
