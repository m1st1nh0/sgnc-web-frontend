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
7. O colaborador tem 2 dias úteis após o envio do feedback para registrar o aceite, digitando a frase de confirmação (mantida). Dias úteis são de segunda a sexta (expediente), sem feriados. Vencido o prazo sem aceite, a NC passa automaticamente para o status **"Não respondida"**, com registro no histórico, e o colaborador analisado e o supervisor dele são notificados. O status aparece no painel, em Insights e no detalhe. Não há contestação neste ciclo.
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
| D5 | Prazo para o colaborador responder. | **2 dias úteis após o envio do feedback.** Depois disso, a NC fica "Não respondida" (D9). |
| D6 | Frase digitada no aceite. | **Mantida.** |
| D7 | Avisos sobre mudança de etapa. | **Avaliar notificações dentro do aplicativo** (ver seção "Avaliação: notificações no aplicativo" e Fase 5). |
| D8 | Dias úteis consideram feriados? | **Não. Só segunda a sexta**, que é o expediente. |
| D9 | O que acontece quando o aceite vence? | **O sistema sinaliza, notifica e a NC passa para o status "Não respondida".** A notificação vai para o colaborador analisado e o supervisor dele. |
| D13 | Quem abriu a NC recebe notificações? | **Revisada em 10/10:** quem abriu recebe **só a decisão** (NC aprovada ou reprovada). Na abertura recebe apenas a confirmação na tela (item 3.4), não uma notificação. Nada além disso por ter aberto. |
| D11 | Depois de "Não respondida", o colaborador ainda pode registrar o aceite? | **Sim.** A NC fica registrada como "Não respondida" no histórico; o aceite tardio exige a frase, conclui a NC (ou leva ao plano de ação se crítica) e fica marcado **"aceito fora do prazo"** no histórico, no PDF e em Insights. |
| D12 | A Qualidade é avisada quando uma NC fica "Não respondida"? | **Não.** A Qualidade acompanha pelo card "Não respondidas" no painel. |
| D10 | Quem da Qualidade recebe aviso de NC nova? | **Todos os usuários com papel Qualidade ou Adm, exceto quem abriu e quem for o colaborador analisado.** Só a Qualidade é avisada da abertura. |
| D14 | NC "Não respondida" conta como ocorrência para reincidência? | **Sim**, porque a NC foi validada. |
| D15 | Nomenclatura do perfil "Funcionário". | **Passa a se chamar "Colaborador"** em toda a interface (rótulos, telas, onboarding, mensagens). O valor interno `funcionario` no banco não muda. |

Modelo de notificações, respondido em 10/10/2026:

| ID | Pergunta | Decisão |
|---|---|---|
| D16 | Quando a NC é contra alguém da Qualidade, essa pessoa é avisada na abertura? | **Não.** É avisada na validação, como colaborador e supervisor. |
| D17 | "Equipe dele" é o líder direto ou toda a cadeia? | **Só o líder direto.** Em **NC crítica**, toda a cadeia de liderança acima do colaborador. |
| D18 | Horário dos lembretes e níveis de urgência. | **Segunda a sexta, das 9h às 18h** (corrigido em 10/10). Níveis: normal → atenção → urgente → crítica (ver Fase 5). |
| D19 | Quem aprova, reprova e aplica medida disciplinar? | **Alguém da Qualidade que não seja o colaborador da NC.** |
| D20 | O líder recebe atualizações do plano de ação? | **Sim.** |
| D21 | Entram no modelo: responsável pela ação, solicitação de causa, etapas da medida e aviso de plano criado? | **Sim, todos.** |
| D22 | Como contar o prazo de aceite? | **Só dentro do expediente** (segunda a sexta, 9h às 18h): 2 dias úteis = 18 horas de expediente. Envio fora do expediente começa a contar às 9h do próximo dia útil. |

Todas as decisões necessárias estão respondidas.


## Fases

Cada fase vira um PR próprio, validado no Preview antes do merge. Ordem: 0 → 1 → 2 → 3 → 4 → 4B → 5 → 6. As fases 1 e 2 são independentes e podem andar em paralelo. A Fase 5 (notificações) depende da 4, porque os eventos de feedback e prazo nascem lá.

### Fase 0: linha de base (pontos 1 e 4)

- [x] 0.1 Confirmar na Vercel (Settings → Functions → Function Region) a região atual. **Resultado (09/10):** as funções rodam em `iad1` (Washington, EUA), confirmado no deployment `dpl_4hoNLSSMSXQo867JzFjeonjzbzDv`; o banco está em `sa-east-1` (São Paulo).
- [ ] 0.2 **Bloqueado em 09/10 e de novo em 10/10:** o ambiente de desenvolvimento do Claude não alcança `*.vercel.app` (política de rede; o proxy recusa o CONNECT) e o plano Hobby guarda só 1 h de logs. Script de medição pronto em `scripts/medir-rotas.mjs` (só GET, aquecimento fora da amostra, mostra a região pelo `x-vercel-id`); rodar quando o domínio for liberado ou localmente por quem tem acesso. Medir tempo de resposta (10 chamadas, p50 e p95) de `GET /api/nc`, `GET /api/nc/[id]`, `GET /api/nc/[id]/evidencias` e `POST /api/nc` no Preview, com sessão de Qualidade. Registrar na seção "Medições".
- [x] 0.3 (por análise de código, sem criar NCs na base de produção) Reproduzir o erro do ponto 4 no Preview: abrir NC como Qualidade com (a) causa digitada sem Enter, (b) causa arquivada, (c) causa inexistente, (d) sem colaborador, (e) sem descrição. Registrar o que cada caso mostra hoje.

  Comportamento antes da Fase 1: (a) causa digitada sem Enter era descartada sem aviso e a NC era aberta sem ela; (b) causa arquivada e (c) causa inexistente para não-Qualidade: 422 com mensagem só no topo; (c) para Qualidade a causa era criada no catálogo; (d) e (e) validadas só no navegador, com erro no campo mas sem foco nem resumo; falha do servidor: mensagem genérica no topo.

### Fase 1: correções rápidas (pontos 2, 4, 6, 7)

**Status (09/10): implementada** (1.1 a 1.5; 1.6 opcional não feita). Itens extras: recarrega o catálogo de causas ao voltar para a aba do formulário; servidor valida colaborador, descrição e criticidade ao abrir NC.

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

**1.5 Nomenclatura "Colaborador" (D15)**
- Trocar o rótulo do papel `funcionario` de "Funcionário" para "Colaborador" em `src/lib/auth/papeis.js`, `UsuariosPage.jsx`, `EquipePage.jsx`, `GestaoEquipes.jsx` (inclusive "Tornar colaborador"), `src/lib/equipes/service.ts` (mensagem de erro), onboarding e PDFs/CSV. O valor `funcionario` no banco e na API continua igual.

**1.6 Refinamento do ponto 5 (opcional)**
- Item "Localize e abra uma NC" leva à lista com a NC mais recente destacada. Só se couber no PR sem atrito.

### Fase 2: desempenho (ponto 1)

- [x] 2.1 Criar `vercel.json` com `"regions": ["gru1"]` (mesma região do Supabase). Validar no Preview que as funções rodam em `gru1`. **Resultado (10/10):** o deployment do Preview deste PR (`dpl_JCQJ8K56bsJZCVFix7UksSrX7F67`) roda em `gru1`, conferido pela API da Vercel.
- [x] 2.2 `src/lib/auth/session.ts`: envolver `getUser` com `cache()` do React para não repetir sessão + leitura de usuário quando a mesma requisição chama `requireUser` mais de uma vez (ex.: `criarNc` → `buscarNc`; `obterTimeline` → `buscarNc`).
  **Divergência (10/10):** testado num build local, o `cache()` do React só memoriza durante a renderização (layout + página); em Route Handlers ele chama a função toda vez. Por isso, além do `cache()`, `buscarNc(id, usuario?)` recebe o usuário já carregado: abertura, edição, avaliação, feedback, aceite, evidências (listar, anexar, excluir), plano de ação e PDF da NC deixam de repetir sessão + leitura do usuário.
- [x] 2.3 `src/lib/nc/service.ts`, `causeIds`: buscar todas as causas numa consulta (`.in("descricao_normalizada", lista)`) em vez de uma por vez. A conferência com o catálogo ficou em `src/lib/nc/causasCatalogo.ts` (função pura, com teste); a lista do filtro vai entre aspas e com escape, para causas com vírgula, parênteses ou aspas.
- [x] 2.4 `HomePage.jsx` e `DetalhesNcPage.jsx`: não esperar `concluirEtapa` (disparar sem `await`, como já faz a abertura). No detalhe, carregar NC e evidências em paralelo.
- [ ] 2.5 Repetir as medições da Fase 0 e registrar o ganho. Meta: p50 de `GET /api/nc/[id]` abaixo de 400 ms no Preview. **Pendente:** depende do acesso a `*.vercel.app` (ver 0.2). Para medir o "antes", rode o script contra a produção atual (`iad1`) e o "depois" contra o Preview deste PR (`gru1`), com a mesma NC (`MEDIR_NC_ID`).
- [ ] 2.6 Fora deste ciclo, registrado como próximo passo: paginação de `listarNcs` (já citado em `backlog-melhorias-operacionais.md`).

### Fase 3: acompanhamento da NC (ponto 3)

- [x] 3.1 `obterTimeline` (`service.ts`): incluir o nome do autor de cada evento (join em `usuarios`), respeitando a regra atual de ocultar `observacao` para acesso restrito.
- [x] 3.2 Novo componente `src/features/nc/components/EtapasNc.jsx`: trilha Aberta → Avaliação → Feedback → Aceite → Concluída (com "Plano de ação" quando `critica`), etapa atual destacada, responsável da etapa e, em "Aceite", o prazo e o desvio para "Não respondida" após a Fase 4. Usado no topo do detalhe, substituindo o bloco "Próxima ação".
- [x] 3.3 Seção "Histórico" no detalhe consumindo `/api/nc/[id]/timeline`: data/hora, autor, de → para, observação.
- [x] 3.4 Após abrir a NC, o detalhe mostra uma confirmação única: "NC #X registrada. Próximo passo: a Qualidade avalia. Você acompanha por aqui ou em Minhas NCs."
- [x] 3.5 `MinhasNcsPage.jsx` e tabela do painel: coluna "Aguardando" com o responsável da etapa (Qualidade, nome do colaborador, liderança).
- [x] 3.6 Teste unit para o mapeamento status → etapa/responsável (extrair para `statusNc.js`).

  **Resultado (10/10):** implementada. Divergências e detalhes: com acesso restrito (quem só registrou a NC e não é Qualidade nem liderança do colaborador), o histórico mostra "Você" para os próprios eventos e o papel do autor ("Qualidade", "Liderança", "Colaborador") no lugar do nome de terceiros, além de ocultar a observação, como já era feito. Eventos sem autor aparecem como "Sistema". A trilha mostra "Plano de ação" quando a NC é crítica, e a NC invalidada encerra a trilha em "Invalidada". O prazo do aceite e o desvio para "Não respondida" entram na Fase 4. Em "Aguardando", quem deve agir vê "Você".

### Fase 4: feedback estruturado e aceite com prazo (ponto 9) (D3–D6, D8, D9, D11 decididos)

Regras decididas: todos os campos do feedback são obrigatórios, exceto o anexo de evidências; não há contestação; o colaborador tem 2 dias úteis (segunda a sexta, sem feriados) após o envio do feedback para aceitar; o aceite continua exigindo a frase digitada; vencido o prazo, a NC vai para "Não respondida".

- [x] 4.0 Migração só de enum (separada, como em `20261008120000_enums_plano_acao_qualidade.sql`): `ALTER TYPE public.status_nc ADD VALUE 'nao_respondida'`.

**Banco (migrações aditivas em `supabase/migrations/`, aplicadas primeiro no Preview)**
- [x] 4.1 Tabela `public.nc_feedbacks`: `id`, `nc_id`, `versao`, `causa_raiz`, `acao_combinada`, `responsavel_acao_id` (uuid → `usuarios`), `prazo_acao` (date), `combinado`, `prazo_aceite` (timestamptz), `registrado_por`, `registrado_em`. Todos `not null`, com `check` de texto não vazio. Uma linha por envio (versão 1 neste ciclo; a coluna `versao` deixa o caminho aberto para revisão futura). RLS ligada sem concessão direta a `authenticated` (padrão da revogação de 07/10).
- [x] 4.2 `public.evidencias`: coluna nova `feedback_id bigint null references nc_feedbacks(id)`. Evidência com `feedback_id` é anexo do feedback; sem, é evidência da abertura. Anexo é opcional.
- [x] 4.3 Função `public.somar_horas_expediente(p_inicio timestamptz, p_horas int)`: soma horas **apenas dentro do expediente** (segunda a sexta, 9h às 18h, fuso `America/Sao_Paulo`, sem feriados; D8, D18, D22). O prazo de aceite é `somar_horas_expediente(envio, 18)` (2 dias úteis × 9 h). Envio fora do expediente começa a contar às 9h do próximo dia útil.
- [x] 4.4 RPC `registrar_feedback_v4(p_nc_id, p_responsavel_id, p_causa_raiz, p_acao, p_responsavel_acao_id, p_prazo_acao, p_combinado)`: mesmas guardas de `aplicar_feedback_nc_v3` (conflito de interesse, status `aguardando_feedback`/`aguardando_analise`); valida todos os campos; `prazo_acao` não pode ser anterior a hoje; responsável da ação deve ser usuário ativo; grava `nc_feedbacks` com `prazo_aceite = somar_horas_expediente(now(), 18)`; preenche `nao_conformidades.feedback` com um resumo legível (compatibilidade com PDF/CSV/dossiê atuais); status → `aguardando_aceite`; histórico. Retorna `feedback_id` para o upload dos anexos.
- [x] 4.5 RPC `marcar_nao_respondidas_v1()`: para cada NC `aguardando_aceite` com `prazo_aceite` vencido, muda para `nao_respondida` e grava histórico ("Prazo de aceite vencido sem resposta"; autor nulo = sistema, confirmar se `historico_nc.usuario_id` aceita nulo). Idempotente e com `FOR UPDATE SKIP LOCKED`. Na Fase 5 essa mesma RPC dispara as notificações.
- [x] 4.5a Agendamento: instalar `pg_cron` e rodar `marcar_nao_respondidas_v1()` a cada 15 minutos (o prazo tem hora, não só dia). Alternativa sem `pg_cron`: Vercel Cron chamando rota protegida por segredo.
- [x] 4.5b `aceitar_nc_v4`: igual à v3 (frase digitada), mas também aceita `nao_respondida` (D11), registrando "Aceite formal do colaborador fora do prazo" no histórico e `aceito_fora_prazo = true` (coluna nova em `nao_conformidades`, padrão `false`).
- [x] 4.5c Garantir que `nao_respondida` entra nas listas de status válidos (`listarNcsDaPessoa`, relatórios, Insights, CSV) e nas regras de reincidência de `validar_nc_com_ocorrencias_v2` (conta como ocorrência, D14).
- [x] 4.6 Backfill: NCs com `feedback` preenchido ganham `nc_feedbacks` versão 1 com `combinado = feedback` e os demais campos com o texto "Não informado (registro anterior a 10/2026)"; `prazo_aceite` calculado a partir de `feedback_aplicado_em`. Não inventar causa raiz.

**Servidor**
- [x] 4.7 `src/lib/nc/service.ts`: `aplicarFeedback` valida os campos e chama `registrar_feedback_v4`; `buscarNc` traz o feedback vigente (com nome do responsável da ação), `prazo_aceite` e se foi aceita no prazo.
- [x] 4.8 `src/lib/nc/evidence.ts` e rota de evidências: aceitar `feedback_id` opcional no upload, só para quem registra o feedback e só para feedback da mesma NC; listagem separa "Evidências da abertura" e "Anexos do feedback".
- [x] 4.9 Nova `obterContextoReincidencia(id)`: NCs anteriores do mesmo colaborador com as mesmas causas nos 12 meses anteriores (mesma regra de `validar_nc_com_ocorrencias_v2`), com status, data, causa raiz, ação e se houve aceite no prazo. Rota `GET /api/nc/[ncId]/reincidencia`, só para quem tem acesso completo.
- [x] 4.10 `transitionError`: mapear os novos códigos (`campo_obrigatorio`, `prazo_invalido`, `responsavel_invalido`) com `campo` para a interface (padrão da Fase 1.2).

**Interface**
- [x] 4.11 `PainelFeedback.jsx`: formulário com causa raiz, ação combinada, responsável pela ação (busca de usuário ativo), prazo da ação, combinado, todos obrigatórios com erro no campo; anexos opcionais (mesmo seletor da abertura) enviados após o registro, com aviso de falha parcial igual ao da abertura. Bloco "Histórico deste colaborador com esta causa" acima do formulário: ocorrência atual ("3ª ocorrência em 12 meses") e NCs anteriores clicáveis. Texto do painel informa: "O colaborador terá 2 dias úteis para registrar o aceite".
- [x] 4.12 `PainelAceite.jsx`: mostra o feedback estruturado, os anexos e o prazo ("Responda até qua, 15/10 às 14:30"); mantém a frase digitada. Em `nao_respondida`, mostra "Prazo vencido em …. O aceite ainda pode ser registrado e ficará marcado como fora do prazo." e mantém a frase digitada (D11).
- [x] 4.13 Detalhe: seção "Feedback" com os cinco campos, anexos, prazo e situação do aceite (aguardando, aceito no prazo, não respondida, aceito fora do prazo).
- [x] 4.14 Painel e Insights: card "Não respondidas" (Qualidade e supervisor, no escopo de cada um), clicável como os demais; aba de status no painel; `statusNc.js` ganha `nao_respondida` ("Não respondida", cor de alerta); em Insights, taxa de aceite no prazo e total de não respondidas por setor.
- [x] 4.15 PDF da NC, CSV e dossiê: incluir causa raiz, ação, responsável, prazo da ação, combinado, prazo do aceite e se foi aceito no prazo.

**Testes**
- [x] 4.16 Unit: validação dos campos obrigatórios; `somar_horas_expediente(…, 18)` (segunda 14h → quarta 14h; sexta 15h → terça 15h; segunda 17h → quarta 17h; sexta 20h → terça 18h; sábado 10h → terça 18h; segunda 7h → terça 18h); permissão do anexo do feedback.
- [x] 4.17 Exercitar no banco do Preview: feedback completo → aceite no prazo; feedback → prazo vencido → job marca "Não respondida" → aceite fora do prazo (D11); NC crítica → aceite → plano de ação; tentativa com campo vazio é recusada. Remover dados temporários.

**Resultado (10/10):** implementada. Migrações `20261010120000`, `20261010121000` e `20261010122000` aplicadas no Supabase com autorização do responsável; `pg_cron` instalado e job `sgnc-marcar-nao-respondidas` a cada 15 minutos. Os seis exemplos de prazo deram certo no Postgres local e no Supabase. O 4.17 rodou no banco do Supabase dentro de uma transação desfeita ao final (nenhum dado gravado): validação → feedback com campo vazio recusado → feedback → aceite no prazo; feedback → prazo vencido → job marca "Não respondida" (segunda execução não marca nada) → crítica marcada em "Não respondida" → aceite tardio leva ao plano de ação e fica fora do prazo; reincidência conta a NC concluída e a "Não respondida" (3ª ocorrência); prazo da ação no passado e conflito de interesse recusados. O backfill não gerou linhas porque a base foi limpa pelo responsável antes da aplicação.

Decisões e ajustes de 10/10 (responsável): `em_plano_acao` também conta como ocorrência para reincidência; NC "Não respondida" pode ser marcada como crítica (`definir_nc_critica_v2`); agendamento por `pg_cron`. Ajustes técnicos: aceite registrado depois do prazo, mas antes de o job passar, também fica "fora do prazo"; feedback legado tem `legado = true` (sem responsável nem prazo da ação, sem inventar causa raiz); `nao_respondida` entrou na lista de status visíveis para colaborador e liderança (sem isso a NC sumiria para eles quando o prazo vencesse); a seção "Feedback" do detalhe fica logo acima do painel de aceite, então o painel de aceite mostra o prazo e a frase e remete ao feedback acima.

### Fase 4B: medida disciplinar em etapas (D19, D21)

Hoje a medida só é **sugerida** na tela de estatísticas (a partir da 4ª ocorrência) e a Qualidade a registra direto como `aplicada`. Não existe aprovar/reprovar. A tabela `medidas_disciplinares` está vazia (0 linhas em 10/10), então a mudança não tem dado a migrar.

Conferência do contrato D19 no código em 10/10:
- **API: de acordo.** `registrarMedidaDisciplinar` exige Qualidade (`requireAdmin`) e `podeAtuarComoQualidade` (bloqueia quem é o colaborador da NC).
- **Banco: de acordo, mas só na camada da aplicação.** `authenticated` tem apenas `SELECT`; escrita só pelo servidor. Não há restrição no banco que impeça `aplicada_por = colaborador_id`.
- **Tela: divergente.** O botão "Registrar medida" aparece para a Qualidade inclusive nas próprias estatísticas (`EstatisticasUsuarioPage.jsx`); o servidor recusa com 403, mas o botão não deveria aparecer.
- **Concorrência:** a duplicidade (mesma NC, causa e ocorrência) é checada antes do `insert`, sem índice único; duas requisições simultâneas podem gravar duas medidas.

Itens:
- [x] 4B.1 Migração: `status` passa a aceitar `sugerida`, `aprovada`, `reprovada`, `aplicada`, `cancelada`; colunas `decidida_por`, `decidida_em`, `motivo_decisao`, `aplicada_em`; `CHECK (decidida_por IS DISTINCT FROM colaborador_id AND aplicada_por IS DISTINCT FROM colaborador_id)`; índice único em `(nc_id, causa_id, ocorrencia_gatilho)`.
- [x] 4B.2 Na validação (`validar_nc_com_ocorrencias_v2` / sucessora), quando a ocorrência atingir o gatilho da medida sugerida, criar a medida com `status = 'sugerida'` na mesma transação.
- [x] 4B.3 RPCs `decidir_medida_v1(p_medida_id, p_usuario_id, p_decisao, p_motivo)` (aprovar/reprovar; motivo obrigatório ao reprovar) e `aplicar_medida_v1(p_medida_id, p_usuario_id, p_data, p_observacao)`; ambas exigem Qualidade que não seja o colaborador e travam a linha (`FOR UPDATE`).
- [x] 4B.4 Tela: lista de medidas pendentes para a Qualidade (sugeridas e aprovadas a aplicar), com aprovar/reprovar/aplicar; esconder as ações quando a pessoa é o próprio colaborador.
- [x] 4B.5 Testes: unit de permissão (Qualidade acusada não decide nem aplica); no banco do Preview, sugerida → aprovada → aplicada e sugerida → reprovada.

**Status (10/10):** código e migração `20261010130000_medida_disciplinar_etapas.sql` prontos e testados no Postgres local; **migração aguardando o "pode aplicar" do responsável**. Divergência: o índice único contra duplicidade (`uq_medida_por_nc_causa_ocorrencia`) já existia em produção; a validação usa `ON CONFLICT` nele. O registro manual direto como "aplicada" (botão "Registrar medida" nas estatísticas) foi removido porque pulava as etapas.

### Fase 5: notificações dentro do aplicativo (D7, D9, D10, D12, D13, D16–D22 decididos)

**Regras gerais (valem para todos os eventos)**

| # | Regra |
|---|---|
| R1 | Quem executou a ação nunca é notificado dela. |
| R2 | O colaborador da NC (acusado) nunca recebe a versão "Qualidade" de um evento da própria NC; recebe só a versão pessoal ou nada. |
| R3 | Uma notificação por pessoa por evento. Se a pessoa acumula papéis, recebe a mais relevante: acusado > responsável pela ação > líder > quem abriu > Qualidade. |
| R4 | Notificação de pendência é resolvida automaticamente quando a pendência acaba (ex.: aceite registrado resolve os avisos de aceite pendente). |
| R5 | Só notifica quem pode abrir a NC, e o texto não expõe o que a pessoa não pode ver (quem abriu sem ser Qualidade não vê o feedback). |
| R6 | "Qualidade" = papéis Qualidade e Adm. |
| R7 | "Líder" = supervisor direto do colaborador (`usuarios.supervisor_id`). Em NC crítica, toda a cadeia acima (D17). |

**Matriz evento × destinatário**

| Evento | Qualidade | Acusado | Líder | Outros |
|---|---|---|---|---|
| NC aberta | ✅ exceto quem abriu e o acusado | — (D16) | — | quem abriu: só confirmação na tela |
| NC validada | ✅ exceto quem validou | ✅ "NC validada contra você" | ✅ "NC validada contra {nome}, da sua equipe" | quem abriu: "sua NC foi aprovada" |
| NC invalidada | — | — | — | quem abriu: "sua NC foi reprovada", com o motivo |
| Feedback aplicado | ✅ exceto quem aplicou | ✅ ação: "precisa do seu aceite até {prazo}" | ✅ "{nome} precisa dar o aceite até {prazo}" | responsável pela ação: "você é responsável por {ação} até {data}" |
| Lembretes de aceite | — | ✅ (escalonados) | ✅ (níveis urgente e crítica) | — |
| NC não respondida (D9) | — (D12) | ✅ crítica | ✅ crítica | — |
| Aceite registrado | ✅ | — (é quem agiu) | resolve a pendência (R4) | — |
| Prazo da ação combinada (1 dia útil antes) | — | — | — | responsável pela ação |
| NC crítica marcada / plano criado | — (quem marcou é da Qualidade, R1) | ✅ | ✅ cadeia toda | — |
| Atualização no plano de ação | ✅ exceto o autor | — | ✅ cadeia toda, exceto o autor (D20) | — |
| Plano de ação concluído | ✅ exceto quem concluiu | ✅ | ✅ cadeia toda | — |
| Medida sugerida (validação atinge o gatilho) | ✅ | — | — | — |
| Medida aprovada / reprovada | ✅ exceto quem decidiu | — | — | — |
| Medida aplicada | ✅ exceto quem aplicou | ✅ "você recebeu uma medida disciplinar" | ✅ "{nome} recebeu uma medida" | — |
| Solicitação de causa nova | ✅ | — | — | — |
| Solicitação de causa decidida | — | — | — | solicitante: aprovada ou rejeitada, com o motivo |

O acusado não recebe "medida sugerida" nem "medida aprovada/reprovada" (R2): recebe só quando a medida é aplicada.

**Lembretes escalonados do aceite (D18)**

Expediente: segunda a sexta, 9h às 18h. Exemplo: feedback na segunda às 14h, prazo na quarta às 14h.

| Momento | Nível | Para quem |
|---|---|---|
| Envio do feedback | normal | acusado e líder |
| Início do dia útil seguinte (9h) | atenção | acusado |
| 4 horas de expediente antes do prazo | urgente | acusado e líder |
| Vencimento → "Não respondida" | crítica | acusado e líder |

- Cada lembrete **atualiza a mesma notificação** (sobe o nível e volta a ficar não lida), sem empilhar avisos.
- O prazo e os lembretes contam **apenas horas de expediente** (D22): 2 dias úteis = 18 horas de expediente. Feedback enviado fora do expediente começa a contar às 9h do próximo dia útil. Como as contas são feitas em horas de expediente, nenhum lembrete cai fora do horário.

**Itens**
- [ ] 5.1 Tabela `public.notificacoes`: `id`, `usuario_id`, `evento`, `papel_destinatario` (`qualidade`, `acusado`, `lider`, `autor`, `responsavel_acao`, `solicitante`), `nivel` (`normal`, `atencao`, `urgente`, `critica`), `nc_id`, `medida_id`, `titulo`, `mensagem`, `link`, `chave_agrupamento`, `criada_em`, `atualizada_em`, `lida_em`, `resolvida_em`. Índice único em `(usuario_id, chave_agrupamento)` para os lembretes; índice em `(usuario_id, resolvida_em, lida_em, criada_em desc)`. RLS ligada sem concessão direta; leitura só pela API.
- [ ] 5.2 Função central `public.notificar_evento(p_evento, p_nc_id, p_autor_id, p_extra jsonb)`: resolve destinatários pela matriz e aplica R1–R7 num só lugar; chamada **dentro** das RPCs de transição (mesma transação do evento). Funções auxiliares: `lideranca_de(colaborador, cadeia boolean)` e `usuarios_qualidade()`.
- [ ] 5.3 `resolver_pendencias(p_nc_id, p_evento)`: marca `resolvida_em` nas notificações de pendência (R4).
- [ ] 5.4 Agendamento (`pg_cron`, a cada 15 min, só no expediente): lembretes escalonados, prazo da ação combinada e `marcar_nao_respondidas_v1()` (Fase 4), todos chamando `notificar_evento`.
- [ ] 5.5 API: `GET /api/notificacoes` (não resolvidas primeiro, últimas 30, contador de não lidas), `POST /api/notificacoes/[id]/lida`, `POST /api/notificacoes/lidas`.
- [ ] 5.6 Interface: sino no `AppNavigation.jsx` com contador e cor pelo maior nível pendente; painel com a lista, cada item leva à NC (ou à medida/causa) e marca como lida. Atualização ao carregar a página, ao voltar o foco para a aba e a cada 60 s com a aba visível.
- [ ] 5.7 Testes: unit da matriz (cada evento × cada papel, incluindo Qualidade acusada, supervisor que abriu NC contra a própria equipe, NC crítica com cadeia); unit dos horários de lembrete em horas de expediente (envio sexta 18h, envio no fim de semana, envio antes das 9h); unit da API (só lê as próprias notificações); no banco do Preview, conferir as notificações geradas por cada transição.
- [ ] 5.8 Fora deste ciclo: e-mail, push do navegador e preferências por pessoa.

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
