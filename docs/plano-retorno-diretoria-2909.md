# Plano: retorno da diretoria de 29/09/2026

Fonte: avaliação de Cristiano A. Canestraro (diretoria), 29/09/2026, com 9 pontos e capturas de tela. Investigação feita em 09/10/2026 contra o código do `main` (`ddb20bd`, mesmo commit em produção na Vercel) e o banco de produção do Supabase (`bxnuslxrlmqzytryxzvv`).

## Goal

> **Fechar os 9 pontos levantados pela diretoria em 29/09/2026: o gestor abre uma NC escolhendo causas só do catálogo, entende em qualquer momento em que etapa ela está e quem precisa agir (inclusive por notificações dentro do aplicativo), recebe erros que apontam o campo a corrigir, navega sem controles redundantes, e o feedback registra causa raiz, ação, responsável, prazo, combinado e reincidência, com o aceite do colaborador controlado por prazo de 2 dias úteis, e as telas principais visivelmente mais rápidas.**

O goal só está concluído quando todos os critérios abaixo forem verdadeiros:

1. Nenhum perfil cria causa digitando texto livre na abertura ou na edição da NC. Causas novas entram somente pela tela `/causas`.
2. Erros de validação e de negócio aparecem junto do campo correspondente, com foco e rolagem até ele. Uma causa digitada e não confirmada bloqueia o envio com aviso no campo. Erros 5xx preservam o formulário e mostram a referência de suporte.
3. O bloco "Seus primeiros passos" não ocupa o topo do painel depois do primeiro acesso.
4. Nenhum botão de "Próxima ação" apenas rola para a seção de baixo: ele aplica o filtro correspondente.
5. O detalhe da NC mostra as etapas do fluxo, a etapa atual, quem deve agir, e a linha do tempo com autor e data de cada transição.
6. O registro de feedback tem campos estruturados e obrigatórios (causa raiz, ação combinada, responsável pela ação, prazo da ação, combinado), aceita anexar evidências de forma opcional e mostra as NCs anteriores do mesmo colaborador com a mesma causa nos últimos 12 meses.
7. O colaborador tem 2 dias úteis após o envio do feedback para registrar o aceite, digitando a frase de confirmação (mantida). Aceite pendente além do prazo aparece como "aceite vencido" no painel, em Insights e no detalhe. Não há contestação neste ciclo.
7a. Cada pessoa recebe notificações dentro do aplicativo para as etapas em que precisa agir ou que acompanha (sino no menu, contador de não lidas, link direto para a NC).
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

## Decisões

Respondidas pelo responsável em 09/10/2026:

| ID | Pergunta | Decisão |
|---|---|---|
| D1 | Onde a Qualidade cadastra causa nova? | **Só no módulo de gestão de causas (`/causas`).** A abertura e a edição de NC não criam causa. |
| D2 | Comportamento dos "Primeiros passos". | **Recolhido por padrão depois do primeiro acesso.** |
| D3 | Campos obrigatórios do feedback. | **Todos obrigatórios** (causa raiz, ação combinada, responsável pela ação, prazo da ação, combinado), **exceto o anexo de evidências**, que é opcional. |
| D4 | Contestação do feedback. | **Não há contestação por enquanto.** O colaborador só aceita. |
| D5 | Prazo para o colaborador responder. | **2 dias úteis após o envio do feedback.** Depois disso, "aceite vencido". |
| D6 | Frase digitada no aceite. | **Mantida.** |
| D7 | Avisos sobre mudança de etapa. | **Avaliar notificações dentro do aplicativo** (ver seção "Avaliação: notificações no aplicativo" e Fase 5). |

Ainda em aberto (não bloqueiam o início):

| ID | Pergunta | Recomendação | Bloqueia |
|---|---|---|---|
| D8 | Dias úteis consideram feriados? | Começar com segunda a sexta. Se precisar de feriados, criar tabela `feriados` cadastrada pela Qualidade. | Fase 4 |
| D9 | O que acontece quando o aceite vence? | Só sinalizar ("aceite vencido") e notificar colaborador, liderança direta e Qualidade. Sem mudança automática de status. | Fase 4 |
| D10 | Quem da Qualidade recebe aviso de NC nova? | Todos os usuários com papel Qualidade/Adm, exceto quem for o colaborador analisado. | Fase 5 |

## Fases

Cada fase vira um PR próprio, validado no Preview antes do merge. Ordem: 0 → 1 → 2 → 3 → 4 → 5 → 6. As fases 1 e 2 são independentes e podem andar em paralelo. A Fase 5 (notificações) depende da 4, porque os eventos de feedback e prazo nascem lá.

### Fase 0: linha de base (pontos 1 e 4)

- [ ] 0.1 Confirmar na Vercel (Settings → Functions → Function Region) a região atual.
- [ ] 0.2 Medir tempo de resposta (10 chamadas, p50 e p95) de `GET /api/nc`, `GET /api/nc/[id]`, `GET /api/nc/[id]/evidencias` e `POST /api/nc` no Preview, com sessão de Qualidade. Registrar na seção "Medições".
- [ ] 0.3 Reproduzir o erro do ponto 4 no Preview: abrir NC como Qualidade com (a) causa digitada sem Enter, (b) causa arquivada, (c) causa inexistente, (d) sem colaborador, (e) sem descrição. Registrar o que cada caso mostra hoje.

### Fase 1: correções rápidas (pontos 2, 4, 6, 7)

**1.1 Causa só do catálogo (ponto 2)** (D1 decidido)
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

**1.3 Primeiros passos recolhidos (ponto 6)** (D2 decidido)
- `src/features/onboarding/components/OnboardingChecklist.jsx`: expandido só no primeiro acesso. A partir do segundo acesso, aparece recolhido numa barra fina com o progresso e o botão "Continuar". "Primeiro acesso" = execução de onboarding criada nesta sessão do navegador ou `iniciado_em` de hoje; a regra exata fica no PR. Expandir/recolher manual guardado em `localStorage` (com try/catch).
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
- [ ] 3.2 Novo componente `src/features/nc/components/EtapasNc.jsx`: trilha Aberta → Avaliação → Feedback → Aceite → Concluída (com "Plano de ação" quando `critica`), etapa atual destacada, responsável da etapa e, em "Aceite", o prazo e a marca "vencido" após a Fase 4. Usado no topo do detalhe, substituindo o bloco "Próxima ação".
- [ ] 3.3 Seção "Histórico" no detalhe consumindo `/api/nc/[id]/timeline`: data/hora, autor, de → para, observação.
- [ ] 3.4 Após abrir a NC, o detalhe mostra uma confirmação única: "NC #X registrada. Próximo passo: a Qualidade avalia. Você acompanha por aqui ou em Minhas NCs."
- [ ] 3.5 `MinhasNcsPage.jsx` e tabela do painel: coluna "Aguardando" com o responsável da etapa (Qualidade, nome do colaborador, liderança).
- [ ] 3.6 Teste unit para o mapeamento status → etapa/responsável (extrair para `statusNc.js`).

### Fase 4: feedback estruturado e aceite com prazo (ponto 9) (D3–D6 decididos; D8, D9 em aberto)

Regras decididas: todos os campos do feedback são obrigatórios, exceto o anexo de evidências; não há contestação; o colaborador tem 2 dias úteis após o envio do feedback para aceitar; o aceite continua exigindo a frase digitada.

**Banco (migrações aditivas em `supabase/migrations/`, aplicadas primeiro no Preview)**
- [ ] 4.1 Tabela `public.nc_feedbacks`: `id`, `nc_id`, `versao`, `causa_raiz`, `acao_combinada`, `responsavel_acao_id` (uuid → `usuarios`), `prazo_acao` (date), `combinado`, `prazo_aceite` (timestamptz), `registrado_por`, `registrado_em`. Todos `not null`, com `check` de texto não vazio. Uma linha por envio (versão 1 neste ciclo; a coluna `versao` deixa o caminho aberto para revisão futura). RLS ligada sem concessão direta a `authenticated` (padrão da revogação de 07/10).
- [ ] 4.2 `public.evidencias`: coluna nova `feedback_id bigint null references nc_feedbacks(id)`. Evidência com `feedback_id` é anexo do feedback; sem, é evidência da abertura. Anexo é opcional.
- [ ] 4.3 Função `public.somar_dias_uteis(p_inicio timestamptz, p_dias int)`: soma dias de segunda a sexta (fuso `America/Sao_Paulo`), mantendo a hora do envio. Se D8 pedir feriados, passa a consultar uma tabela `feriados`.
- [ ] 4.4 RPC `registrar_feedback_v4(p_nc_id, p_responsavel_id, p_causa_raiz, p_acao, p_responsavel_acao_id, p_prazo_acao, p_combinado)`: mesmas guardas de `aplicar_feedback_nc_v3` (conflito de interesse, status `aguardando_feedback`/`aguardando_analise`); valida todos os campos; `prazo_acao` não pode ser anterior a hoje; responsável da ação deve ser usuário ativo; grava `nc_feedbacks` com `prazo_aceite = somar_dias_uteis(now(), 2)`; preenche `nao_conformidades.feedback` com um resumo legível (compatibilidade com PDF/CSV/dossiê atuais); status → `aguardando_aceite`; histórico. Retorna `feedback_id` para o upload dos anexos.
- [ ] 4.5 `aceitar_nc_v3` continua como está (frase digitada). Grava também `aceito_em` comparável com `prazo_aceite` para marcar "aceite fora do prazo" no histórico.
- [ ] 4.6 Backfill: NCs com `feedback` preenchido ganham `nc_feedbacks` versão 1 com `combinado = feedback` e os demais campos com o texto "Não informado (registro anterior a 10/2026)"; `prazo_aceite` calculado a partir de `feedback_aplicado_em`. Não inventar causa raiz.

**Servidor**
- [ ] 4.7 `src/lib/nc/service.ts`: `aplicarFeedback` valida os campos e chama `registrar_feedback_v4`; `buscarNc` traz o feedback vigente (com nome do responsável da ação), `prazo_aceite` e `aceite_vencido` (calculado: `aguardando_aceite` e `now() > prazo_aceite`).
- [ ] 4.8 `src/lib/nc/evidence.ts` e rota de evidências: aceitar `feedback_id` opcional no upload, só para quem registra o feedback e só para feedback da mesma NC; listagem separa "Evidências da abertura" e "Anexos do feedback".
- [ ] 4.9 Nova `obterContextoReincidencia(id)`: NCs anteriores do mesmo colaborador com as mesmas causas nos 12 meses anteriores (mesma regra de `validar_nc_com_ocorrencias_v2`), com status, data, causa raiz, ação e se houve aceite no prazo. Rota `GET /api/nc/[ncId]/reincidencia`, só para quem tem acesso completo.
- [ ] 4.10 `transitionError`: mapear os novos códigos (`campo_obrigatorio`, `prazo_invalido`, `responsavel_invalido`) com `campo` para a interface (padrão da Fase 1.2).

**Interface**
- [ ] 4.11 `PainelFeedback.jsx`: formulário com causa raiz, ação combinada, responsável pela ação (busca de usuário ativo), prazo da ação, combinado, todos obrigatórios com erro no campo; anexos opcionais (mesmo seletor da abertura) enviados após o registro, com aviso de falha parcial igual ao da abertura. Bloco "Histórico deste colaborador com esta causa" acima do formulário: ocorrência atual ("3ª ocorrência em 12 meses") e NCs anteriores clicáveis. Texto do painel informa: "O colaborador terá 2 dias úteis para registrar o aceite".
- [ ] 4.12 `PainelAceite.jsx`: mostra o feedback estruturado, os anexos e o prazo ("Responda até qua, 15/10 às 14:30"); mantém a frase digitada. Depois do prazo, mostra aviso "Prazo vencido" mas ainda permite o aceite (D9).
- [ ] 4.13 Detalhe: seção "Feedback" com os cinco campos, anexos, prazo e situação do aceite (no prazo, fora do prazo, vencido).
- [ ] 4.14 Painel e Insights: card "Aceite vencido" (Qualidade e supervisor, no escopo de cada um), clicável como os demais; em Insights, taxa de aceite no prazo.
- [ ] 4.15 PDF da NC, CSV e dossiê: incluir causa raiz, ação, responsável, prazo da ação, combinado, prazo do aceite e se foi aceito no prazo.

**Testes**
- [ ] 4.16 Unit: validação dos campos obrigatórios; `somar_dias_uteis` (sexta 15h + 2 = terça 15h; sábado + 2 = terça; quarta + 2 = sexta); permissão do anexo do feedback.
- [ ] 4.17 Exercitar no banco do Preview: feedback completo → aceite no prazo; feedback → aceite vencido → aceite fora do prazo; NC crítica → aceite → plano de ação; tentativa com campo vazio é recusada. Remover dados temporários.

### Fase 5: notificações dentro do aplicativo (D7; D10 em aberto)

Ver avaliação abaixo. Entrega mínima:
- [ ] 5.1 Tabela `public.notificacoes`: `id`, `usuario_id`, `tipo`, `nc_id`, `titulo`, `mensagem`, `criada_em`, `lida_em`. Índice em `(usuario_id, lida_em, criada_em desc)`. RLS ligada sem concessão direta; leitura só pela API.
- [ ] 5.2 Função `public.notificar(p_usuarios uuid[], p_tipo, p_nc_id, p_titulo, p_mensagem)`, chamada **dentro** das RPCs de transição para que a notificação nasça na mesma transação do evento:
  - NC aberta → Qualidade (D10), exceto o colaborador analisado.
  - NC validada / invalidada → quem abriu.
  - Feedback registrado → colaborador ("Você tem até … para registrar o aceite") e quem abriu; responsável pela ação ("Você é responsável por … até …").
  - Aceite registrado → quem abriu e quem registrou o feedback.
  - NC crítica marcada / plano de ação concluído → envolvidos do plano.
- [ ] 5.3 Aceite vencido: job diário (extensão `pg_cron`, disponível e ainda não instalada no projeto) que, para NCs `aguardando_aceite` com prazo vencido e ainda sem aviso, notifica colaborador, liderança direta e quem registrou o feedback. Alternativa sem `pg_cron`: Vercel Cron chamando uma rota protegida.
- [ ] 5.4 API: `GET /api/notificacoes` (últimas 30, não lidas primeiro, contador), `POST /api/notificacoes/[id]/lida`, `POST /api/notificacoes/lidas` (marcar todas).
- [ ] 5.5 Interface: sino no `AppNavigation.jsx` com contador; painel com a lista, cada item leva à NC e marca como lida. Atualização ao carregar a página, ao voltar o foco para a aba e a cada 60 s com a aba visível.
- [ ] 5.6 Testes: unit da API (só lê as próprias notificações); no banco do Preview, conferir que cada transição gera as notificações certas e nenhuma para o colaborador analisado quando ele é da Qualidade.
- [ ] 5.7 Fora deste ciclo: e-mail e notificação push do navegador.

### Fase 6: validação e devolutiva

- [ ] 6.1 UAT no Preview com Qualidade, supervisor e funcionário, cobrindo os 9 pontos e as notificações, desktop e mobile.
- [ ] 6.2 Atualizar `backlog-melhorias-operacionais.md` com o estado final.
- [ ] 6.3 Preencher a seção "Devolutiva" abaixo, em linguagem de negócio, ponto a ponto.

## Avaliação: notificações no aplicativo

**Situação atual.** Não existe nenhum mecanismo de aviso: a pessoa só descobre que precisa agir abrindo o painel. O banco não publica tabelas no Realtime do Supabase e a leitura direta pelo navegador foi revogada em 07/10 (toda leitura passa pela API Next). As extensões `pg_cron` e `pg_net` estão disponíveis, mas não instaladas.

**Opções avaliadas.**

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| A. Tabela + consulta periódica pela API (recomendada) | RPCs gravam em `notificacoes`; o navegador consulta `/api/notificacoes` ao abrir a página, ao focar a aba e a cada 60 s | Mantém toda leitura pela API (mesma segurança de hoje); simples; notificação nasce na mesma transação do evento, sem perda | Atraso de até 60 s; uma chamada leve por minuto por aba aberta |
| B. Tabela + Supabase Realtime | Mesma tabela, entregue por websocket | Aviso instantâneo | Exige reabrir leitura direta com RLS só para `notificacoes` e manter sessão Supabase no navegador; mais superfície de segurança para pouco ganho neste volume |
| C. Calculadas na hora, sem tabela | API monta os avisos a partir do status das NCs | Nada novo no banco | Sem "lida/não lida", sem histórico, não avisa eventos passados (ex.: NC validada) |

**Recomendação:** opção A. O volume é pequeno (dezenas de NCs por mês), o atraso de um minuto é aceitável para o fluxo, e a opção preserva a decisão de segurança de 07/10. Se depois houver necessidade de aviso instantâneo, a mesma tabela serve para a opção B sem retrabalho.

**Esforço estimado:** 1 PR médio (migração, gatilhos nas RPCs, 3 rotas, componente do sino, job diário).

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
