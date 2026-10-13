# Aderência do SGNC ao "Processo de Gestão de Não Conformidades"

Comparação, em 13/10/2026, entre o documento da Qualidade (atualizado em 30/09/2026) e o que está em produção no `main` (`7f94746`, depois das Fases 0 a 6 do retorno da diretoria e das Fases A e B1 da estrutura organizacional).

Legenda: ✅ atendido · 🟡 parcial · ❌ não atendido · ⚠️ conflita com uma decisão já registrada no `CLAUDE.md`.

## Resumo

| Seção do documento | ✅ | 🟡 | ❌ |
|---|---|---|---|
| 2. Premissa (procedimento na intranet, NC Orientativa) | 0 | 0 | 2 |
| 3. Papéis | 2 | 2 | 1 |
| 4. Criticidade | 1 | 2 | 4 |
| 5.2 Informações do registro | 8 | 1 | 2 |
| 5.2 Informações das etapas seguintes | 4 | 3 | 3 |
| 6. Fluxo e status | 1 | 5 | 5 |
| 7. Reincidência e medidas | 3 | 2 | 4 |
| 9. Indicadores | 3 | 1 | 5 |
| 10. Avaliação do processo | 0 | 0 | 1 |
| **Total (65 itens)** | **22 (34%)** | **16 (25%)** | **27 (42%)** |

Em resumo, o sistema cobre bem o **registro, a validação, o feedback com aceite, o plano de ação da NC crítica, as medidas em etapas e as notificações**. As lacunas estão concentradas em cinco frentes:

1. **Premissa do procedimento documentado:** não há campo de procedimento nem link da intranet, e não existe "NC Orientativa".
2. **Causa individual × sistêmica:** essa separação não existe. Hoje toda NC conta para a reincidência e para as medidas.
3. **Criticidade com prazos próprios:** faltam contenção em 24 h, prazo de feedback de 5 dias úteis ou 1 dia útil e encaminhamento da crítica ao RH.
4. **Ciclo de verificação:** falta a janela de 30 dias com resultado eficaz ou não eficaz, além dos status "Em verificação", "Reaberta" e "Escalada".
5. **Indicadores de efetividade:** faltam efetividade do feedback, feedback no prazo, redução das ocorrências e eficácia dos planos.

Os percentuais são aproximados. Cada linha conta como um item, independentemente do esforço.

## Detalhe por seção

### 2. Abrangência e premissa

| Requisito | Situação | Observação |
|---|---|---|
| Cobrança só sobre procedimento documentado e publicado na intranet | ❌ | A NC não registra o procedimento. |
| Sem procedimento, segue como **NC Orientativa**, sem contar para progressão | ❌ | Não existe esse tipo de NC. |

### 3. Papéis

| Papel | Situação | Observação |
|---|---|---|
| Analista de Qualidade conduz todas as etapas | ✅ | Papel `qualidade` (e `adm`). A segregação impede conduzir a própria NC. |
| Supervisor participa e acompanha | ✅ | Hierarquia por liderança, visão da equipe e notificações. |
| Gestores da área analisam indicadores e decidem em causa sistêmica | 🟡 | Departamentos e cargos existem (Fase B1), mas não há visão nem decisão própria de "gestor da área". |
| RH aplica medidas disciplinares | ❌ ⚠️ | Não há papel RH. Pela decisão de 09/10, a medida é decidida e aplicada pela Qualidade. |
| Diretoria formaliza desligamento junto ao RH | 🟡 | A Diretoria existe na estrutura (`usuarios.diretoria`) e recebe aviso de NC crítica, mas não há fluxo de desligamento. |

### 4. Classificação de criticidade

| Requisito | Situação | Observação |
|---|---|---|
| Duas classes: Leve e Crítica | 🟡 | Hoje existem Baixa/Média/Alta e a marcação separada "NC crítica". |
| Contenção imediata obrigatória em até 24 h (crítica) | ❌ | |
| Comunicação: leve avisa o supervisor; crítica avisa supervisor e gestores no mesmo dia | ✅ | Notificações: líder direto; na crítica, a cadeia até a Diretoria. |
| Prazo para feedback: 5 dias úteis (leve) e 1 dia útil (crítica) | ❌ | Só existe o prazo do aceite (2 dias úteis), não o prazo da Qualidade para dar o feedback. |
| Plano de ação opcional na leve e obrigatório na crítica | 🟡 | Obrigatório na crítica; a leve não tem como abrir plano. |
| Encerramento: leve após feedback; crítica após verificação de eficácia | ❌ | A leve encerra no aceite, não no feedback; a crítica, na conclusão do plano, sem janela de verificação. |
| NC crítica vai ao RH para medida independentemente da contagem | ❌ | A medida só nasce da contagem de reincidência. |

### 5.2 Informações obrigatórias: registro

| Campo | Situação |
|---|---|
| Número da NC gerado pelo sistema | ✅ |
| Colaborador | ✅ |
| Área/equipe | ✅ (`setor`, departamento) |
| Gestor responsável | ✅ (derivado da liderança) |
| Data da ocorrência e do registro | ✅ |
| Origem (monitoria, auditoria, supervisão, indicador, reclamação) | ❌ |
| Procedimento descumprido com link da intranet | ❌ |
| Tipo/causa | ✅ (catálogo fechado) |
| Descrição objetiva | ✅ |
| Evidências anexadas | 🟡 (opcionais; o documento pressupõe que existam) |
| Criticidade e responsável pelo registro | ✅ |

### 5.2 Informações obrigatórias: etapas seguintes

| Campo | Situação | Observação |
|---|---|---|
| Data do feedback | ✅ | |
| Participantes do feedback | ❌ | Fica registrado só quem lançou. |
| Resumo da conversa | 🟡 | O campo "combinado" faz esse papel em parte. |
| Posicionamento do colaborador (escuta) | ❌ | |
| Ação esperada | ✅ | "Ação combinada". |
| Ciência | ✅ | Aceite com a frase digitada e prazo. |
| Plano de ação: ação, responsável e prazo | 🟡 | O feedback tem ação, responsável e prazo; o plano completo só existe na crítica. |
| Registros de acompanhamento | ✅ | No plano de ação. |
| Resultado da verificação: eficaz ou não eficaz | 🟡 | Texto livre de "verificação de eficácia", sem resultado binário. |
| Data de encerramento ou escalonamento | ❌ | Há data de encerramento; não há escalonamento. |

### 6. Fluxo e status

| Requisito | Situação | Observação |
|---|---|---|
| Identificação por supervisor ou outra área, repassada à Qualidade | ✅ | Qualquer perfil abre; a Qualidade valida. |
| Registro feito pelo Analista no ato | 🟡 ⚠️ | O documento põe o registro só com a Qualidade; hoje qualquer perfil abre e a Qualidade valida. Na prática equivale ao "repasse". |
| Validação: evidência suficiente e existência de procedimento | 🟡 | Valida ou invalida com motivo, mas não há checagem de procedimento. |
| Supervisor notificado no registro | 🟡 | Na abertura, a matriz decidida avisa só a Qualidade; o supervisor é avisado na validação. |
| Análise de causa em até 2 dias úteis (crítica: no mesmo dia) | ❌ | Não há prazo nem etapa própria; a causa raiz entra junto com o feedback. |
| Feedback conjunto Analista + Gestor | ❌ | O feedback é registrado pela Qualidade, sem o gestor como participante. |
| Status do documento: Aberta, Feedback pendente, Em ação, Em verificação, Encerrada, Reaberta e Escalada | 🟡 | Aberta, Aguardando feedback, Aguardando aceite, Não respondida, Em plano de ação, Concluída e Invalidada. Equivalem parcialmente; faltam os três abaixo. |
| Status "Em verificação" com janela de 30 dias | ❌ | |
| "Reaberta" quando a verificação não é eficaz | ❌ | |
| "Escalada" para RH ou gestores da área | ❌ | |
| Ações vencidas sinalizadas aos gestores da área | 🟡 | O responsável é avisado um dia útil antes do prazo; o aviso aos gestores depois do vencimento não existe. |

### 7. Reincidência e medidas disciplinares

| Requisito | Situação | Observação |
|---|---|---|
| Contador automático por causa | ✅ | `ocorrencia_numero`, janela de 12 meses. |
| Só NCs de cobrança com causa individual contam | ❌ | Não há distinção de orientativa nem de sistêmica. |
| 3 NCs da mesma causa geram medida | 🟡 ⚠️ | Hoje a 1ª medida nasce na **4ª** ocorrência e depois a cada 3. O documento indica a 3ª. |
| Contador zerado depois da medida, com histórico mantido | 🟡 | O efeito é parecido (nova medida a cada 3), mas o contador não zera e usa uma janela de 12 meses em vez do "ciclo vigente". |
| 3 medidas levam a suspensão; 3 suspensões, a desligamento | ✅ | Sugestões: 1ª a 3ª advertência, 4ª a 6ª suspensão, 7ª em diante avaliação de justa causa. |
| Medida em etapas, com segregação | ✅ | Sugerida, aprovada ou reprovada, aplicada; quem é o colaborador não decide nem aplica. |
| RH executa a medida | ❌ ⚠️ | Hoje é a Qualidade (decisão de 09/10). |
| Antes de encaminhar, conferir procedimento, evidência, causa individual e feedback | ❌ | Não há checagem; a sugestão nasce na validação. |
| NC crítica vai ao RH independentemente da contagem | ❌ | |

### 9. Indicadores

| Indicador | Situação | Observação |
|---|---|---|
| Volume por área, causa e criticidade | ✅ | Insights e Relatórios. |
| NCs por causa | ✅ | Falta o corte individual × sistêmica. |
| Medidas disciplinares | ✅ | Só as aplicadas. |
| Taxa de reincidência (reincidentes ÷ colaboradores com NC) | 🟡 | Há total de reincidentes e reincidência por causa e por colaborador, não a taxa nessa fórmula. |
| Redução das ocorrências contra o período anterior | ❌ | Não há comparação com o período anterior. |
| Efetividade do feedback (sem nova NC da mesma causa em 30 dias) | ❌ | |
| Feedback no prazo da criticidade | ❌ | Depende do prazo de feedback (seção 4). Hoje existe só "aceite no prazo". |
| Planos concluídos no prazo e eficazes | ❌ | |
| Causas sistêmicas identificadas e corrigidas | ❌ | Depende da distinção individual × sistêmica. |

### 10. Avaliação do processo

| Requisito | Situação | Observação |
|---|---|---|
| Linha de base de 90 dias e auditoria amostral da completude dos registros | ❌ | Os indicadores servem à linha de base, mas não há visão de completude (evidência, procedimento, feedback e verificação preenchidos). |

## Decisões do responsável (13/10/2026)

As sete decisões foram respondidas e estão registradas em [`plano-processo-gestao-nc.md`](plano-processo-gestao-nc.md), que também lista as perguntas que ainda faltam (Q1 a Q11). Em resumo:

1. Criticidade continua Baixa/Média/Alta; a marcação de crítica, só depois da validação.
2. Prazo de feedback e contenção em 24 h: sim.
3. A medida nasce na 3ª NC da mesma causa e o contador zera.
4. Sem papel RH: o sistema registra, o RH aplica presencialmente.
5. Qualquer perfil abre; a Qualidade valida.
6. A NC sem plano encerra no aceite.
7. O supervisor é avisado só na validação.

## Proposta de ordem (detalhada no plano)

1. **Premissa e classificação:** campos "procedimento" (com link da intranet) e "origem"; tipo de NC (cobrança ou orientativa); causa individual ou sistêmica. Só cobrança com causa individual conta para reincidência e medidas.
2. **Criticidade com prazos:** prazo de feedback por criticidade, contenção em 24 h na crítica, NC crítica encaminhada à medida e plano de ação opcional na leve.
3. **Feedback completo:** participantes (Analista + Gestor), posicionamento do colaborador e resumo da conversa.
4. **Verificação de 30 dias:** status "Em verificação", resultado eficaz ou não eficaz, "Reaberta" e "Escalada", e aviso de ação vencida aos gestores da área.
5. **Gestores da área:** aviso de ação vencida e escalonamento ao responsável do departamento (sem papel RH, conforme a decisão 4).
6. **Indicadores de efetividade:** efetividade do feedback, feedback no prazo, redução por causa, eficácia dos planos, taxa de reincidência pela fórmula do documento e auditoria de completude.
