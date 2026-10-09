# Plano: retorno da diretoria de 29/09/2026

Fonte: avaliação de Cristiano A. Canestraro (diretoria), 29/09/2026, com 9 pontos e capturas de tela. Investigação feita em 09/10/2026 contra o código do `main` (`ddb20bd`, mesmo commit em produção na Vercel) e o banco de produção do Supabase (`bxnuslxrlmqzytryxzvv`).

## Goal

> **Fechar os 9 pontos levantados pela diretoria em 29/09/2026: o gestor abre uma NC escolhendo causas só do catálogo, entende em qualquer momento em que etapa ela está e quem precisa agir, recebe erros que apontam o campo a corrigir, navega sem controles redundantes, e o feedback registra causa raiz, ação, responsável, prazo, reincidência e a resposta do colaborador (aceite ou contestação), com as telas principais visivelmente mais rápidas.**

O goal só está concluído quando todos os critérios abaixo forem verdadeiros:

1. Nenhum perfil cria causa digitando texto livre na abertura ou na edição da NC. Causas novas entram somente pela tela `/causas`.
2. Erros de validação e de negócio aparecem junto do campo correspondente, com foco e rolagem até ele. Uma causa digitada e não confirmada bloqueia o envio com aviso no campo. Erros 5xx preservam o formulário e mostram a referência de suporte.
3. O bloco "Seus primeiros passos" não ocupa o topo do painel depois do primeiro acesso.
4. Nenhum botão de "Próxima ação" apenas rola para a seção de baixo: ele aplica o filtro correspondente.
5. O detalhe da NC mostra as etapas do fluxo, a etapa atual, quem deve agir, e a linha do tempo com autor e data de cada transição.
6. O registro de feedback tem campos estruturados (causa raiz, ação combinada, responsável, prazo, combinado) e mostra as NCs anteriores do mesmo colaborador com a mesma causa nos últimos 12 meses.
7. O colaborador pode aceitar **ou contestar** o feedback com justificativa. A contestação volta para a Qualidade, que mantém ou revisa o feedback, e tudo fica no histórico. Aceite pendente além do prazo aparece como "aceite vencido".
8. As funções da Vercel rodam na mesma região do banco (`gru1`, São Paulo) e o tempo das rotas `/api/nc`, `/api/nc/[id]` e da abertura de NC foi medido antes e depois, com ganho registrado neste documento.
9. Lint, typecheck, `npm test` e os novos testes passam. Cada fase foi validada no Preview com os perfis Qualidade, supervisor e funcionário.
10. A devolutiva para a diretoria (seção "Devolutiva" ao final) foi preenchida com o que mudou em cada ponto.

## Diagnóstico por ponto

| # | Relato da diretoria | Situação em 09/10 | Evidência |
|---|---|---|---|
| 1 | Lentidão ao operar | Procede | Banco em `sa-east-1`. O projeto não define região de funções (padrão Vercel: `iad1`, EUA). Cada rota faz 3 a 5 consultas em sequência (sessão, usuário, equipe, NC, causas). Painel e detalhe esperam o registro do onboarding antes de seguir; o detalhe carrega evidências só depois da NC. `causeIds` consulta uma causa por vez. |
| 2 | Causa tem que vir de cadastro fechado | Parcial | Funcionário e supervisor já só escolhem do catálogo. Qualidade/Adm ainda criam causa digitando (`AbrirNcPage.jsx` e `EditarNcPage.jsx`: `permitirCriacaoDireta`; `service.ts`: `allowCreate`). Banco tem causas como "asasdasda", "bateu errado", "não tenho ideia" (arquivadas). |
| 3 | Abri a NC, e agora? Onde vejo o status? | Parcial | Detalhe mostra "Próxima ação". A rota `/api/nc/[ncId]/timeline` existe mas nenhuma tela a usa. Não há visão das etapas nem aviso a quem abriu. |
| 4 | Erro ao salvar sem dizer o que faltou | Procede | Em 29/09 há duas NCs abertas com sucesso às 15:44 e 15:45 (horário local), sem registro da falha; os logs do dia já expiraram. Hoje: 5xx vira mensagem genérica no topo; erros de causa (422) também vão para o topo; causa digitada sem Enter é descartada sem aviso. |
| 5 | Item do onboarding não levava a lugar algum | Resolvido | Item virou "Localize e abra uma NC" com destino à lista (`b34fe80`). |
| 6 | "Primeiros passos" sempre aparecendo | Procede | `OnboardingChecklist.jsx` só some com "Ocultar" ou com todas as tarefas concluídas. |
| 7 | Botão leva para a tela logo abaixo | Procede | `homeUx.js:89` e `:148`: destino `#lista-ncs-home`, na mesma página. |
| 8 | Cards deveriam filtrar a lista | Resolvido | Cards filtram e rolam até a lista (`b11fc1d`). |
| 9 | Feedback sem controle | Procede | `aplicar_feedback_nc_v3` grava um único texto. `aceitar_nc_v3` só aceita; não há recusa nem contestação. Reincidência é calculada na validação (`nc_causas.ocorrencia_numero`, `nao_conformidades.reincidencia`), mas a tela de feedback não mostra as NCs anteriores. |

## Decisões em aberto (precisam de resposta antes da fase indicada)

| ID | Decisão | Recomendação | Bloqueia |
|---|---|---|---|
| D1 | Qualidade pode cadastrar causa na tela de abertura (via modal que grava no catálogo) ou só em `/causas`? | Só em `/causas`, com link "Cadastrar no catálogo" no campo. | Fase 1 |
| D2 | Primeiros passos: recolher por padrão ou sumir sozinho após N acessos? | Recolhido em uma barra fina ("Primeiros passos 5/9 · Continuar") após o primeiro acesso. | Fase 1 |
| D3 | Campos obrigatórios do feedback estruturado. | Obrigatórios: causa raiz, ação combinada, combinado. Opcionais: responsável da ação e prazo. | Fase 4 |
| D4 | Quem decide uma contestação e quais saídas existem? | Qualidade (outra pessoa que não o colaborador) escolhe "manter feedback" (conclui com registro) ou "revisar feedback" (volta para aguardando aceite). | Fase 4 |
| D5 | Prazo para o colaborador responder. | 5 dias corridos; depois disso aparece "aceite vencido" no painel e em Insights. Sem mudança automática de status. | Fase 4 |
| D6 | Manter a frase digitada no aceite? | Trocar por caixa de confirmação + botão; a frase não agrega controle e gera atrito. | Fase 4 |
| D7 | Avisar quem abriu a NC quando ela muda de etapa (e-mail)? | Fora deste ciclo; o painel e "Minhas NCs" passam a mostrar a etapa e o responsável. | — |

## Fases

Cada fase vira um PR próprio, validado no Preview antes do merge. Ordem: 0 → 1 → 2 → 3 → 4 → 5. As fases 1 e 2 são independentes e podem andar em paralelo.

### Fase 0: linha de base (pontos 1 e 4)

- [ ] 0.1 Confirmar na Vercel (Settings → Functions → Function Region) a região atual.
- [ ] 0.2 Medir tempo de resposta (10 chamadas, p50 e p95) de `GET /api/nc`, `GET /api/nc/[id]`, `GET /api/nc/[id]/evidencias` e `POST /api/nc` no Preview, com sessão de Qualidade. Registrar na seção "Medições".
- [ ] 0.3 Reproduzir o erro do ponto 4 no Preview: abrir NC como Qualidade com (a) causa digitada sem Enter, (b) causa arquivada, (c) causa inexistente, (d) sem colaborador, (e) sem descrição. Registrar o que cada caso mostra hoje.

### Fase 1: correções rápidas (pontos 2, 4, 6, 7)

**1.1 Causa só do catálogo (ponto 2)**
- `src/features/nc/components/AbrirNcPage.jsx` e `EditarNcPage.jsx`: remover `permitirCriacaoDireta`. Para Qualidade, o campo oferece link "Cadastrar no catálogo" que abre `/causas` em nova aba; para os demais perfis, mantém "Solicitar análise".
- `src/features/nc/components/CampoCausas.jsx`: remover o ramo de criação direta (botão "Adicionar causa ao catálogo" e Enter criando causa).
- `src/lib/nc/service.ts`: `criarNc` e `editarNc` chamam `causeIds` com `allowCreate: false`. A edição mantém `allowInactive: true` para não quebrar NCs antigas com causa arquivada.
- Testes: ajustar `tests/nc-edit.unit.spec.ts`; adicionar caso "Qualidade com causa fora do catálogo recebe 422".

**1.2 Erros apontam o campo (ponto 4)**
- `src/lib/api/error.ts`: `ApiError` ganha `campo?: string` opcional; `apiErrorResponse` inclui `campo` no JSON quando status < 500.
- `src/lib/api/client/api.js`: `ErroApi` guarda `campo`.
- `src/lib/nc/service.ts`: erros de `causeIds` usam `campo: "causas"`; `collaborator` usa `campo: "colaborador"`.
- `CampoCausas.jsx`: expor o texto pendente ao formulário (prop `aoMudarPendente`). Em `AbrirNcPage.aoEnviar` e na edição, texto pendente vira erro de campo "Selecione uma causa da lista ou apague o texto digitado".
- `AbrirNcPage.jsx`: erro com `campo` vai para `errosCampo[campo]`; após qualquer erro, rolar e focar o primeiro campo com problema; o banner do topo passa a listar os campos ("Revise: Colaborador, Causas"). Erro 5xx mantém mensagem com referência de suporte.
- Testes: unit de `apiErrorResponse` com `campo`; cenário de causa pendente no regression `test_pr11_cause_governance.mjs` ou novo spec.

**1.3 Primeiros passos recolhidos (ponto 6)** (depende de D2)
- `src/features/onboarding/components/OnboardingChecklist.jsx`: modo recolhido (barra com progresso e botão "Continuar") quando já houve interação anterior (`progresso.status === "em_andamento"` e alguma etapa concluída). Expandir/recolher guardado em `localStorage` (com try/catch).
- Manter "Ocultar primeiros passos" e o acesso via "Rever apresentação" no menu do usuário.

**1.4 Botão de próxima ação filtra (ponto 7)**
- `src/features/nc/client/homeUx.js`: ações de destaque passam a ter `filtro` (rótulo do card) em vez de `destino: "#lista-ncs-home"`. Qualidade: "Ver NCs aguardando avaliação" → filtro "Aguardando avaliação". Supervisor: filtro do card correspondente.
- `src/features/nc/components/HomePage.jsx`: quando `acao.filtro` existe, o botão chama `filtrarPeloCard(acao.filtro)`.
- Atualizar `test_ux_operacao_indicadores.mjs` / `test_pr09_onboarding.mjs` se verificarem o destino antigo.

**1.5 Refinamento do ponto 5 (opcional)**
- Item "Localize e abra uma NC" leva à lista com a NC mais recente destacada. Só se couber no PR sem atrito.

### Fase 2: desempenho (ponto 1)

- [ ] 2.1 Criar `vercel.json` com `"regions": ["gru1"]` (mesma região do Supabase). Validar no Preview que as funções rodam em `gru1`.
- [ ] 2.2 `src/lib/auth/session.ts`: envolver `getUser` com `cache()` do React para não repetir sessão + leitura de usuário quando a mesma requisição chama `requireUser` mais de uma vez (ex.: `criarNc` → `buscarNc`; `obterTimeline` → `buscarNc`).
- [ ] 2.3 `src/lib/nc/service.ts`, `causeIds`: buscar todas as causas numa consulta (`.in("descricao_normalizada", lista)`) em vez de uma por vez.
- [ ] 2.4 `HomePage.jsx` e `DetalhesNcPage.jsx`: não esperar `concluirEtapa` (disparar sem `await`, como já faz a abertura). No detalhe, carregar NC e evidências em paralelo.
- [ ] 2.5 Repetir as medições da Fase 0 e registrar o ganho. Meta: p50 de `GET /api/nc/[id]` abaixo de 400 ms no Preview.
- [ ] 2.6 Fora deste ciclo, registrado como próximo passo: paginação de `listarNcs` (já citado em `backlog-melhorias-operacionais.md`).

### Fase 3: acompanhamento da NC (ponto 3)

- [ ] 3.1 `obterTimeline` (`service.ts`): incluir o nome do autor de cada evento (join em `usuarios`), respeitando a regra atual de ocultar `observacao` para acesso restrito.
- [ ] 3.2 Novo componente `src/features/nc/components/EtapasNc.jsx`: trilha Aberta → Avaliação → Feedback → Aceite → Concluída (com "Plano de ação" quando `critica`, e "Contestada" após a Fase 4), etapa atual destacada, responsável da etapa. Usado no topo do detalhe, substituindo o bloco "Próxima ação".
- [ ] 3.3 Seção "Histórico" no detalhe consumindo `/api/nc/[id]/timeline`: data/hora, autor, de → para, observação.
- [ ] 3.4 Após abrir a NC, o detalhe mostra uma confirmação única: "NC #X registrada. Próximo passo: a Qualidade avalia. Você acompanha por aqui ou em Minhas NCs."
- [ ] 3.5 `MinhasNcsPage.jsx` e tabela do painel: coluna "Aguardando" com o responsável da etapa (Qualidade, nome do colaborador, liderança).
- [ ] 3.6 Teste unit para o mapeamento status → etapa/responsável (extrair para `statusNc.js`).

### Fase 4: feedback estruturado e resposta do colaborador (ponto 9) (depende de D3, D4, D5, D6)

**Banco (migrações aditivas em `supabase/migrations/`, aplicadas primeiro no branch/Preview)**
- [ ] 4.1 Migração só de enum (separada, como em `20261008120000_enums_plano_acao_qualidade.sql`): `ALTER TYPE public.status_nc ADD VALUE 'contestada'`.
- [ ] 4.2 Tabela `public.nc_feedbacks` (histórico de versões do feedback): `id`, `nc_id`, `versao`, `causa_raiz`, `acao_combinada`, `responsavel_acao_id` (uuid, nulo), `prazo_acao` (date, nulo), `combinado`, `registrado_por`, `registrado_em`. RLS ligada sem concessão direta a `authenticated` (mesmo padrão da revogação de 07/10).
- [ ] 4.3 Tabela `public.nc_respostas_colaborador`: `id`, `nc_id`, `feedback_id`, `decisao` (`aceite` | `contestacao`), `justificativa`, `respondido_por`, `respondido_em`; e para contestação: `decisao_qualidade` (`mantido` | `revisado`), `decidido_por`, `decidido_em`, `observacao_qualidade`.
- [ ] 4.4 RPC `registrar_feedback_v4(p_nc_id, p_responsavel_id, p_causa_raiz, p_acao, p_responsavel_acao_id, p_prazo, p_combinado)`: mesmas guardas de `aplicar_feedback_nc_v3` (conflito de interesse, status), aceita também `contestada` (revisão), grava nova versão em `nc_feedbacks`, preenche `nao_conformidades.feedback` com um resumo (compatibilidade com PDF/CSV), vai para `aguardando_aceite`, grava histórico.
- [ ] 4.5 RPC `responder_feedback_v1(p_nc_id, p_colaborador_id, p_decisao, p_justificativa)`: só o colaborador analisado, só em `aguardando_aceite`. Aceite → mesma saída de `aceitar_nc_v3` (concluída ou plano de ação se crítica). Contestação (justificativa obrigatória, mín. 10 caracteres) → `contestada`. Histórico em ambos.
- [ ] 4.6 RPC `decidir_contestacao_v1(p_nc_id, p_responsavel_id, p_decisao, p_observacao)`: Qualidade sem conflito. `mantido` → concluída (ou plano de ação se crítica) com registro "mantida após contestação"; `revisado` → volta para `aguardando_feedback` para nova versão.
- [ ] 4.7 Backfill: para NCs com `feedback` preenchido, criar `nc_feedbacks` versão 1 com `combinado = feedback`; para NCs com `aceito_em`, criar resposta `aceite`. Não inventar causa raiz.

**Servidor**
- [ ] 4.8 `src/lib/nc/service.ts`: `aplicarFeedback` valida e chama `registrar_feedback_v4`; nova `responderFeedback`; nova `decidirContestacao`; `buscarNc` passa a trazer o feedback vigente e as respostas; `aceitarNc` vira atalho de `responderFeedback` com `aceite` (rota antiga continua funcionando).
- [ ] 4.9 Nova função `obterContextoReincidencia(id)`: NCs anteriores do mesmo colaborador com as mesmas causas nos 12 meses anteriores (mesma regra de `validar_nc_com_ocorrencias_v2`), com status, data, feedback vigente (causa raiz e ação) e resposta. Rota `GET /api/nc/[ncId]/reincidencia`, só para quem tem acesso completo.
- [ ] 4.10 Rotas novas: `POST /api/nc/[ncId]/resposta`, `POST /api/nc/[ncId]/contestacao/decidir`.
- [ ] 4.11 `transitionError`: mapear os novos códigos de erro.

**Interface**
- [ ] 4.12 `PainelFeedback.jsx`: formulário estruturado (causa raiz, ação combinada, responsável pela ação com busca de usuário, prazo, combinado). Bloco "Histórico deste colaborador com esta causa" acima do formulário, com ocorrência atual ("3ª ocorrência em 12 meses") e as NCs anteriores clicáveis. Medida disciplinar sugerida continua vindo da validação.
- [ ] 4.13 `PainelAceite.jsx` → `PainelResposta.jsx`: mostra o feedback estruturado e oferece "Aceitar" (caixa de confirmação, se D6 aprovado) ou "Contestar" (justificativa obrigatória).
- [ ] 4.14 Novo `PainelContestacao.jsx` para a Qualidade quando status `contestada`: mostra justificativa, opções manter/revisar.
- [ ] 4.15 Detalhe: seção "Feedback" exibe a versão vigente e versões anteriores; `statusNc.js` ganha `contestada`; `EtapasNc` mostra o desvio.
- [ ] 4.16 Painel e Insights: card "Contestadas" para Qualidade; indicador "Aceite vencido" (prazo D5, calculado por `feedback_aplicado_em`), clicável como os demais cards.
- [ ] 4.17 PDF da NC, CSV e dossiê: incluir causa raiz, ação, responsável, prazo, resposta do colaborador e decisão da contestação.

**Testes**
- [ ] 4.18 Unit: permissões de resposta (só colaborador), decisão de contestação (Qualidade sem conflito), validação dos campos obrigatórios.
- [ ] 4.19 Exercitar as RPCs no banco do Preview: feedback → aceite; feedback → contestação → mantido; feedback → contestação → revisado → aceite; NC crítica → aceite → plano de ação. Remover dados temporários.

### Fase 5: validação e devolutiva

- [ ] 5.1 UAT no Preview com Qualidade, supervisor e funcionário, cobrindo os 9 pontos, desktop e mobile.
- [ ] 5.2 Atualizar `backlog-melhorias-operacionais.md` com o estado final.
- [ ] 5.3 Preencher a seção "Devolutiva" abaixo, em linguagem de negócio, ponto a ponto.

## Medições

| Rota | Antes (p50 / p95) | Depois (p50 / p95) |
|---|---|---|
| `GET /api/nc` | — | — |
| `GET /api/nc/[id]` | — | — |
| `GET /api/nc/[id]/evidencias` | — | — |
| `POST /api/nc` | — | — |

## Devolutiva para a diretoria

_Preencher na Fase 5._

| # | Ponto | O que mudou | Onde ver |
|---|---|---|---|
| 1 | Lentidão | | |
| 2 | Causa cadastrada | | |
| 3 | Status após abrir | | |
| 4 | Erro ao salvar | | |
| 5 | Onboarding sem destino | Resolvido em 01/10 | Painel → Primeiros passos |
| 6 | Primeiros passos repetitivo | | |
| 7 | Botão redundante | | |
| 8 | Cards filtrando a lista | Resolvido em 02/10 | Painel → cards de status |
| 9 | Controle do feedback | | |
