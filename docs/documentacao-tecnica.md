# SGNC: documentação técnica

Sistema de Gestão de Não Conformidades. Este documento descreve como o aplicativo é construído, onde fica cada regra e como trabalhar no código. Para o uso do sistema, veja o [manual do usuário](manual-do-usuario.md).

Estado descrito: `main` em 14/10/2026.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Estrutura do repositório](#3-estrutura-do-repositório)
4. [Ambiente e execução local](#4-ambiente-e-execução-local)
5. [Autenticação, sessão e segurança](#5-autenticação-sessão-e-segurança)
6. [Perfis e permissões](#6-perfis-e-permissões)
7. [Ciclo de vida da NC](#7-ciclo-de-vida-da-nc)
8. [Modelo de dados](#8-modelo-de-dados)
9. [Funções do banco (RPCs), gatilhos e agendamentos](#9-funções-do-banco-rpcs-gatilhos-e-agendamentos)
10. [Regras de negócio](#10-regras-de-negócio)
11. [API (Route Handlers)](#11-api-route-handlers)
12. [Interface](#12-interface)
13. [Relatórios](#13-relatórios)
14. [Testes e checks](#14-testes-e-checks)
15. [Deploy e operação](#15-deploy-e-operação)
16. [Convenções de contribuição](#16-convenções-de-contribuição)
17. [Documentos relacionados](#17-documentos-relacionados)

---

## 1. Visão geral

O SGNC registra e conduz não conformidades (NCs) de colaboradores, do registro até o encerramento:

- qualquer pessoa abre uma NC sobre um colaborador;
- a Qualidade valida ou invalida;
- a Qualidade registra o feedback estruturado;
- o colaborador formaliza o aceite em até 2 dias úteis;
- NCs marcadas como críticas seguem para um plano de ação;
- a reincidência por causa gera medidas disciplinares, que a Qualidade aprova ou reprova.

O sistema também mantém a estrutura organizacional (lideranças, departamentos e cargos), envia notificações dentro do aplicativo e gera indicadores e relatórios (PDF, Excel e CSV).

Código, textos de interface e commits são em português.

## 2. Arquitetura

```
Navegador (React 19, client components)
   │  fetch /api/...  (cookies de sessão do Supabase)
   ▼
Next.js 16 na Vercel, região gru1 (São Paulo)
   ├── src/proxy.ts            renova a sessão e aplica CSP com nonce em cada página
   ├── src/app/(app)/*         páginas (server components que checam papel e montam o client)
   ├── src/app/api/*           Route Handlers: finos, só chamam src/lib
   └── src/lib/*               regras, permissões, consultas, relatórios
          │  service role (servidor apenas)
          ▼
Supabase, projeto bxnuslxrlmqzytryxzvv, região sa-east-1
   ├── Auth (e-mail e senha)
   ├── Postgres: tabelas, RPCs *_vN, triggers de histórico e notificação
   ├── pg_cron: "Não respondida" e lembretes a cada 15 min
   └── Storage: bucket privado "evidencias"
```

Decisões que moldam o código:

- **Toda leitura e escrita passa pela API Next.** A leitura direta das tabelas pelo navegador foi revogada em 07/10/2026 (`20261007120000_revoke_direct_nc_reads.sql`). O servidor usa o service role (`createAdminClient`) e aplica o escopo do usuário em TypeScript (`src/lib/permissions`). A RLS continua ligada como defesa em profundidade.
- **Transições de status acontecem só em RPCs versionadas** (`validar_nc_com_workflow_v3`, `registrar_feedback_v4`, `aceitar_nc_v4`…). Cada RPC trava a linha, confere status e permissão e grava em `historico_nc` na mesma transação. A API nunca dá `update` direto no status.
- **Notificações nascem no banco**, por triggers nas tabelas que as RPCs gravam. Assim o aviso faz parte da mesma transação do evento.
- **Funções e banco na mesma região** (`vercel.json` → `gru1`), para reduzir a latência de cada consulta.

### Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers, `proxy.ts`) |
| UI | React 19, React Bootstrap 2 / Bootstrap 5, CSS próprio (`src/index.css`, `src/redesign.css`) |
| Gráficos | Recharts 3 |
| Banco e autenticação | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| PDF | `pdf-lib` (sem dependência extra para gráficos) |
| Excel | Gerador próprio em `src/lib/reports/xlsx.ts` (XML + zip com o deflate nativo do Node) |
| Linguagem | TypeScript 7 no servidor; JSX/JS nos componentes de cliente |
| Testes | Playwright (unit, http, browser) e scripts `test_*.mjs` de regressão |

## 3. Estrutura do repositório

```
src/
  app/
    (app)/                 páginas autenticadas (layout com menu, sino e onboarding)
      page.tsx             painel inicial (varia por perfil)
      abrir-nc/            abertura de NC
      minhas-ncs/          NCs em que a pessoa é o colaborador ou que ela abriu
      nc/[id]/             detalhe da NC (e /editar, só Qualidade)
      causas/              catálogo de causas e solicitações (Qualidade)
      medidas/             medidas disciplinares (Qualidade)
      equipe/              pessoas, equipes, estrutura e acessos
      insights/            indicadores
      relatorios/          relatórios e exportações
      usuarios/[id]/       dossiê e estatísticas da pessoa
    api/                   Route Handlers (ver seção 11)
    login/, trocar-senha/  telas públicas / de senha provisória
    actions/auth.ts        server actions de login e logout
  components/              navegação, UI genérica e gráficos
  features/<área>/         componentes e serviços de cliente por área
    auth, nc, insights, notificacoes, onboarding, reports, users
  lib/                     regras do servidor
    api/                   ApiError, leitura de JSON, cliente HTTP do navegador
    auth/                  sessão, papéis, guardas de API
    nc/                    NC, feedback, evidências, plano de ação, medidas, reincidência, timeline
    permissions/           regras puras de acesso (testáveis sem banco)
    notificacoes/          listagem, leitura e espelho das regras de expediente
    equipes/, estrutura/, usuarios/, onboarding/
    analytics/             insights e estatísticas
    reports/               PDF, Excel, CSV e formatação
    supabase/              clientes (browser, server, admin)
  proxy.ts                 sessão + CSP
supabase/migrations/       migrações SQL (aditivas)
tests/                     specs do Playwright
test_*.mjs                 regressão estática da interface
scripts/medir-rotas.mjs    medição de latência das rotas
docs/                      planos, decisões e esta documentação
```

Padrão de uma rota da API: o arquivo em `src/app/api` só lê parâmetros, chama a função de `src/lib` e converte erros com `apiErrorResponse`:

```ts
export async function POST(request: Request, context: Context) {
  try { return Response.json(await avaliarNc(Number((await context.params).ncId), await readJson(request))); }
  catch (error) { return apiErrorResponse(error); }
}
```

Rotas desconhecidas caem em `src/app/api/[...path]/route.ts`, que devolve 404 em JSON.

## 4. Ambiente e execução local

### Requisitos

- Node.js compatível com o Next.js 16 (veja os requisitos da versão instalada).
- Acesso a um projeto Supabase com as migrações de `supabase/migrations/` aplicadas.

### Variáveis de ambiente

| Variável | Onde é usada | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador, servidor, proxy | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | navegador, servidor, proxy | chave pública; `NEXT_PUBLIC_SUPABASE_ANON_KEY` é aceita como alternativa |
| `SUPABASE_SERVICE_ROLE_KEY` | só servidor (`src/lib/supabase/admin.ts`, marcado `server-only`) | nunca expor ao navegador nem versionar |

Credenciais de teste e o token de bypass da Vercel nunca entram no repositório.

### Comandos

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm run start
npm run lint
npm run typecheck    # next typegen + tsc --noEmit
npm test             # regressão (test_*.mjs) + testes unitários
npm run test:api     # specs *.http.spec.ts
npm run test:e2e     # specs *.browser.spec.ts (desktop e mobile)
```

Os testes do Playwright sobem o app com `npm run start` e um Supabase fictício (`https://example.supabase.co`), então rode `npm run build` antes. Os testes unitários não dependem de banco.

## 5. Autenticação, sessão e segurança

- **Login:** e-mail e senha no Supabase Auth (`src/app/actions/auth.ts`, `LoginPage.jsx`).
- **Senha provisória:** todo usuário criado pelo Administrador nasce com `usuarios.senha_provisoria = true`. `requireUser` redireciona para `/trocar-senha` até a troca. A nova senha precisa ter 10 ou mais caracteres, com maiúscula, minúscula, número e símbolo (`src/features/auth/client/senhaPolicy.js`).
- **Sessão no servidor:** `getUser` (`src/lib/auth/session.ts`) lê o usuário do Auth e a linha de `usuarios` (nome, papel, ativo, senha provisória). Usuário inativo ou com papel desconhecido é tratado como não autenticado. A função é envolvida por `cache()` do React, o que evita repetir a consulta entre layout e página. Em Route Handlers o `cache()` não memoriza, então as funções internas recebem o usuário já carregado (`buscarNc(id, usuario)`).
- **Guardas:**
  - páginas: `requireUser`, `requireRole([...])`, `requirePermission(fn)`, que redirecionam;
  - API: `requireApiUser`, `requireApiQualidade`, `requireApiAdmin` (`src/lib/auth/api.ts`), que lançam `ApiError` 401/403.
- **`src/proxy.ts`:** roda em todas as páginas (exceto `/api` e estáticos), renova os cookies da sessão do Supabase e define a Content-Security-Policy com nonce por requisição (`script-src 'self' 'nonce-…' 'strict-dynamic'`; conexões só para o próprio domínio e o Supabase).
- **Cabeçalhos** (`next.config.ts`): HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` restritiva, sem `X-Powered-By`.
- **Erros:** `ApiError(mensagem, status, campo?)`.
  - Status abaixo de 500: a resposta é `{ detail, campo? }`. O `campo` permite à tela focar o campo com problema.
  - Status 500 ou mais, ou erro não tratado: a resposta é `{ detail: "Serviço temporariamente indisponível.", request_id }`. O detalhe técnico vai só para o log, com o mesmo `request_id`.
- **Evidências:** bucket privado `evidencias`. O download usa URL assinada válida por 10 minutos. Extensões aceitas: png, jpg, jpeg, gif, webp, pdf, doc, docx, xlsx. O limite é 15 MB por arquivo.

## 6. Perfis e permissões

### Perfis (`usuarios.papel`)

| Valor interno | Nome na tela | Resumo |
|---|---|---|
| `adm` | Administrador do sistema | Tudo da Qualidade, mais a gestão de usuários e acessos |
| `qualidade` | Qualidade | Avalia NCs, registra feedback, conduz planos de ação, causas, medidas, estrutura e equipes |
| `supervisor` | Supervisor | Vê e acompanha a própria cadeia de liderados |
| `funcionario` | **Colaborador** | Abre NCs, acompanha as suas e dá o aceite |

O valor interno `funcionario` não muda no banco nem na API. Na interface ele é sempre "Colaborador". Os helpers ficam em `src/lib/auth/papeis.js`:

- `ehQualidade` (adm ou qualidade);
- `ehAdminSistema` (só adm);
- `podeLiderar` (supervisor, qualidade ou adm);
- `precisaDeLideranca` (todos, exceto quem é da Diretoria).

### Perfil × posição

Perfil é permissão; posição é a liderança (`usuarios.supervisor_id`).

- Todos têm liderança, inclusive Qualidade e Adm. A exceção são os membros da Diretoria (`usuarios.diretoria = true`), que ficam no topo. Pode haver mais de um.
- A cadeia de liderança passa por qualquer pessoa que tenha liderados, independentemente do perfil (`listarPessoasAbaixo`, `nc_lidera_colaborador`, `lideranca_de`).
- O diretor (CEO) tem perfil Supervisor no topo. Ele vê toda a empresa pela hierarquia, mas não conduz NCs como Qualidade.

### Escopo de leitura de NCs (`src/lib/permissions/nc-scope.ts`, `nc.ts`)

- **Qualidade/Adm:** todas as NCs.
- **Demais perfis:** NCs que a pessoa abriu, mais as NCs cujo colaborador é ela mesma ou alguém da sua cadeia de liderados. A cadeia inclui liderados diretos e indiretos e só vale para quem tem perfil Supervisor.
- **Acesso completo** (`temAcessoCompleto`) vale para Qualidade, o colaborador analisado, quem decidiu a NC e a liderança do colaborador. Quem só abriu a NC recebe a **visão resumida** (`filterSensitive`), sem:
  - motivo de invalidação;
  - feedback e texto do aceite;
  - datas das etapas;
  - motivo da criticidade.
- O **responsável por uma ação combinada** no feedback pode abrir a NC mesmo fora do escopo, pela notificação. Ele recebe a visão resumida e só a própria ação (`sua_acao`).

### Conflito de interesse

A Qualidade nunca conduz NC em que é o colaborador analisado. O controle é feito por `podeAtuarComoQualidade` (`src/lib/permissions/plano-acao.ts`) e `requireQualidadeSemConflito` (`src/lib/nc/service.ts`), e repetido nas RPCs (erro `conflito_interesse`) e em CHECKs do banco para as medidas. Vale para:

- avaliar;
- registrar feedback;
- editar e excluir;
- marcar como crítica e mexer no plano;
- decidir e aplicar medida;
- remover evidências.

### Matriz de telas

| Tela | Adm | Qualidade | Supervisor | Colaborador |
|---|:-:|:-:|:-:|:-:|
| Painel, Minhas NCs, Abrir NC, detalhe, Meu dossiê | ✅ | ✅ | ✅ | ✅ |
| Insights, Relatórios, Pessoas e equipes | ✅ | ✅ | ✅ (própria cadeia) | — |
| Editar NC, Causas, Medidas disciplinares | ✅ | ✅ | — | — |
| Aba Acessos (usuários) | ✅ | — | — | — |

## 7. Ciclo de vida da NC

### Status (`public.status_nc`)

| Valor | Nome na tela | Quem age |
|---|---|---|
| `aberta` | Aberta | Qualidade avalia |
| `invalidada` | Invalidada | — (encerrada) |
| `aguardando_feedback` | Aguardando feedback | Qualidade registra o feedback |
| `aguardando_aceite` | Aguardando aceite | Colaborador analisado |
| `nao_respondida` | Não respondida | Colaborador (aceite fora do prazo) |
| `em_plano_acao` | Em plano de ação | Qualidade e liderança |
| `concluida` | Concluída | — |
| `validada`, `aguardando_analise` | legados, tratados como "Aguardando feedback" | Qualidade |

A fonte única de rótulos, cores, etapas e "quem precisa agir" é `src/features/nc/client/statusNc.js` (`STATUS_INFO`, `acaoPendente`, `etapasDaNc`).

### Fluxo

```
            ┌─────────── invalidar (motivo) ──► invalidada
aberta ─────┤
            └─ validar ──► aguardando_feedback ── feedback ──► aguardando_aceite
                                                                 │        │
                                              prazo vence (job)  │        │ aceite (frase)
                                                                 ▼        ▼
                                                        nao_respondida ──► concluida
                                                           (aceite fora       (ou em_plano_acao
                                                            do prazo)          se a NC é crítica)

em_plano_acao: planejamento → em_execucao → em_acompanhamento → concluído (verificação de eficácia) ──► concluida
```

| Transição | RPC | Regras principais |
|---|---|---|
| Abrir | `criar_nc_com_historico_v3` | colaborador, descrição e criticidade (Baixa/Média/Alta) obrigatórios; causas só do catálogo ativo |
| Editar | `editar_nc_v3` | só Qualidade sem conflito; aceita causa arquivada já vinculada |
| Validar | `validar_nc_com_workflow_v3` → `validar_nc_com_ocorrencias_v2` | numera a ocorrência por causa e gera medida "passível" quando aplicável |
| Invalidar | `invalidar_nc_v3` | motivo obrigatório |
| Feedback | `registrar_feedback_v4` | 5 campos obrigatórios; prazo do aceite = 18 h de expediente |
| Aceite | `aceitar_nc_v4` | só o colaborador analisado, com a frase exata; aceita também `nao_respondida` (marca `aceito_fora_prazo`) |
| Não respondida | `marcar_nao_respondidas_v1` (pg_cron) | `aguardando_aceite` com prazo vencido; idempotente (`FOR UPDATE SKIP LOCKED`) |
| Crítica | `definir_nc_critica_v2` | só Qualidade sem conflito, depois da validação; justificativa com no mínimo 10 caracteres; cria o plano |
| Plano de ação | `salvar_plano_acao_v1`, `registrar_acompanhamento_plano_v1`, `concluir_plano_acao_v1` | ver seção 10.5 |

Frase do aceite (comparada sem diferenciar maiúsculas e espaços extras):

```
li e concordo com a não conformidade e com o feedback aplicado
```

Excluir uma NC é permitido só para a Qualidade sem conflito. Fica bloqueado se a NC é ou já foi crítica, ou se tem plano de ação, para preservar a auditoria.

## 8. Modelo de dados

Tabelas principais do schema `public`. As migrações em `supabase/migrations/` documentam as colunas de cada uma.

| Tabela | Conteúdo |
|---|---|
| `usuarios` | Pessoa (id = id do Auth): nome, e-mail, `papel`, `ativo`, `senha_provisoria`, `supervisor_id`, `diretoria`, `departamento_id`, `cargo_id`, `setor` (espelha o nome do departamento) |
| `departamentos` | Nome, `departamento_pai_id` (sub-áreas), `responsavel_id`, `ativo` |
| `cargos` | Nome, `departamento_id` opcional, `lideranca` (sugere o perfil Supervisor), `ativo` |
| `historico_equipes` | Trocas de liderança, perfil, departamento e cargo |
| `nao_conformidades` | NC: data, chamado, colaborador, criticidade, descrição, status, autor, datas de cada etapa, `critica`, `critica_motivo`, `aceito_fora_prazo`… |
| `causas` | Catálogo: `descricao`, `descricao_normalizada` (única), `ativo` |
| `nc_causas` | NC × causa, com `ocorrencia_numero` (posição da NC no ciclo da causa) |
| `solicitacoes_causa` | Pedidos de causa nova feitos por quem não é da Qualidade |
| `historico_nc` | Linha do tempo: status anterior → novo, autor (nulo = sistema), observação, data |
| `nc_feedbacks` | Feedback estruturado versionado: causa raiz, ação combinada, responsável e prazo da ação, combinado, `prazo_aceite`, `legado` |
| `evidencias` | Arquivos no Storage; `feedback_id` nulo = evidência da abertura, preenchido = anexo do feedback |
| `planos_acao` | Plano da NC crítica: status, causa raiz, ações, responsável, prazo, execução, verificação de eficácia |
| `plano_acao_acompanhamentos` | Registros de acompanhamento do plano |
| `medidas_disciplinares` | Medida por NC × causa: `tipo`, `tipo_sugerido`, `status`, `origem`, decisão, aplicação, dias de suspensão |
| `notificacoes` | Avisos no aplicativo (seção 10.6) |
| `onboarding_execucoes` (e etapas) | Progresso dos "Primeiros passos" por usuário e perfil |

Enums relevantes:

- `status_nc` (seção 7);
- `papel_usuario` (`adm`, `qualidade`, `supervisor`, `funcionario`);
- status da medida: `sugerida` (na tela, "Passível de medida"), `aprovada`, `reprovada`, `aplicada`, `cancelada`;
- tipo da medida: `advertencia`, `suspensao`, `avaliar_justa_causa`;
- origem da medida: `reincidencia`, `nc_critica`, `reincidencia_e_critica`;
- status do plano: `planejamento`, `em_execucao`, `em_acompanhamento`, `concluido`, `cancelado`.

RLS está ligada nas tabelas, sem concessão direta de escrita a `authenticated`. As tabelas novas (`nc_feedbacks`, `notificacoes`, `departamentos`, `cargos`…) são acessíveis só pelo service role.

## 9. Funções do banco (RPCs), gatilhos e agendamentos

### RPCs em uso pela API

| Área | Funções |
|---|---|
| NC | `criar_nc_com_historico_v3`, `editar_nc_v3`, `validar_nc_com_workflow_v3`, `invalidar_nc_v3`, `registrar_feedback_v4`, `aceitar_nc_v4`, `definir_nc_critica_v2` |
| Plano de ação | `salvar_plano_acao_v1`, `registrar_acompanhamento_plano_v1`, `concluir_plano_acao_v1`, `nc_pode_alimentar_plano` |
| Medidas | `decidir_medida_v1`, `aplicar_medida_v1`, `ocorrencia_no_ciclo`, `proxima_medida_do_ciclo`, `medida_para_nc_critica` |
| Causas | `decidir_solicitacao_causa` |
| Equipes | `alterar_equipe_v2`, `nc_lidera_colaborador` |
| Prazos | `somar_horas_expediente(inicio, horas)`, `proximo_dia_util(data)` |
| Notificações | `notificar_evento`, `resolver_pendencias`, `lideranca_de(colaborador, cadeia)`, `usuarios_qualidade()`, `lembretes_notificacoes_v1` |

As RPCs devolvem `{ ok: true, ... }` ou `{ ok: false, erro: "<código>" }`. O servidor traduz os códigos em mensagens e status HTTP:

- `transitionError` em `src/lib/nc/service.ts`;
- `ERROS` em `src/lib/nc/plano-acao.ts`;
- `erroDaMedida` em `src/lib/nc/medidas.ts`;
- `erroDoFeedback` em `src/lib/nc/feedback.ts`.

### Gatilhos

| Tabela | Gatilho | Efeito |
|---|---|---|
| `historico_nc` (insert) | `notificar_historico_nc` | abertura, validação, invalidação, feedback, aceite, "Não respondida" |
| `nao_conformidades` (update de `critica`) | `notificar_nc_critica`, `medida_ao_marcar_critica` | avisa a cadeia; gera medida da NC crítica |
| `planos_acao` (update de `status`) | `notificar_plano_concluido` | plano concluído |
| `plano_acao_acompanhamentos` (insert) | `notificar_plano_acompanhamento` | atualização do plano |
| `medidas_disciplinares` (insert/update de `status`) | `notificar_medida` | medida passível, decidida, aplicada |
| `solicitacoes_causa` (insert/update de `status`) | `notificar_solicitacao_causa` | pedido de causa e decisão |

### Agendamentos (`pg_cron`)

| Job | Frequência | Função |
|---|---|---|
| `sgnc-marcar-nao-respondidas` | a cada 15 min | `marcar_nao_respondidas_v1()` |
| `sgnc-lembretes-notificacoes` | a cada 15 min, só no expediente | `lembretes_notificacoes_v1()` (lembretes do aceite e prazo da ação combinada) |

## 10. Regras de negócio

As regras abaixo foram decididas pelo responsável e registradas em `CLAUDE.md` e nos planos de `docs/`. Decisão nova deve ser perguntada ao responsável, não assumida.

### 10.1 Causas

- Causa nova só entra pelo catálogo em `/causas` (Qualidade/Adm). Abertura e edição de NC nunca criam causa, para nenhum perfil (`causeIds` → `resolverCausasDoCatalogo`).
- A comparação usa `descricao_normalizada` (minúsculas, espaços colapsados). Todas as causas da NC são buscadas numa só consulta.
- Quem não é da Qualidade pode pedir uma causa nova, com descrição de 3 a 120 caracteres e justificativa de 10 a 1.000. A Qualidade aprova, aproveita uma causa existente ou rejeita, e a rejeição exige motivo.
- Causa com NC vinculada não é excluída, só arquivada (`ativo = false`).

### 10.2 Feedback e prazo do aceite

- Campos obrigatórios: causa raiz, ação combinada, responsável pela ação (usuário ativo), prazo da ação (não anterior a hoje em São Paulo) e combinado, cada um com no máximo 4.000 caracteres. A validação está em `validarFeedback` e é repetida na RPC. O anexo é opcional e só quem registrou o feedback pode anexar, logo após o registro.
- **Prazo do aceite:** 2 dias úteis = 18 horas de expediente, calculado por `somar_horas_expediente(envio, 18)`.
  - O expediente é de segunda a sexta, das 9h às 18h, no fuso `America/Sao_Paulo`, sem feriados.
  - Envio fora do expediente começa a contar às 9h do próximo dia útil.
  - Exemplos: segunda 14h vence quarta 14h; sexta 15h vence terça 15h; sábado 10h vence terça 18h.
  - `src/lib/notificacoes/lembretes.ts` é o espelho em TypeScript usado em testes; o banco é a fonte de verdade.
- Vencido o prazo, o job leva a NC a "Não respondida", com histórico ("Prazo de aceite vencido sem resposta"), e avisa o colaborador e a liderança direta. A Qualidade não é avisada.
- Depois de "Não respondida", o colaborador ainda pode aceitar com a frase; o aceite fica marcado como "aceito fora do prazo". O aceite registrado depois do prazo, mas antes de o job passar, também fica fora do prazo.
- Não há contestação do feedback neste ciclo.

### 10.3 Reincidência

- Contam como ocorrência as NCs validadas do mesmo colaborador e da mesma causa, nos status `aguardando_feedback`, `aguardando_aceite`, `nao_respondida`, `em_plano_acao` e `concluida` (`STATUS_CONTAM_OCORRENCIA`).
- No painel de feedback, a Qualidade vê as NCs anteriores com a mesma causa nos 12 meses anteriores (`GET /api/nc/[id]/reincidencia`).

### 10.4 Medidas disciplinares

Implementadas no banco, em `20261013120000_medida_ciclo_tres_ncs.sql`:

- **Gatilho:** a cada 3 NCs da mesma causa (3ª, 6ª, 9ª…) o colaborador fica passível de medida (status `sugerida`).
- **Ciclo:** 12 meses por colaborador e causa, contados a partir da 1ª NC da causa. Fechada a janela, contador e escada zeram.
- **Escada por causa no ciclo:** medidas 1 a 3 são advertência; 4 a 6, suspensão; da 7ª em diante, avaliação de justa causa. Só sobem a escada as medidas aprovadas ou aplicadas; passível sem decisão, reprovada e cancelada não contam.
- **NC com mais de uma causa:** conta +1 em cada causa, e cada causa pode gerar a sua medida.
- **NC crítica:** fica passível de medida em cada causa, independentemente da contagem. Se a contagem já gerou medida para aquela causa e NC, é uma só, com origem `reincidencia_e_critica`.
- **Etapas:** passível → aprovada ou reprovada → aplicada.
  - Só Qualidade/Adm que não seja o colaborador pode decidir ou aplicar. Há CHECK no banco para isso.
  - Reprovar exige motivo com no mínimo 10 caracteres.
  - Ao aprovar, a Qualidade pode trocar o tipo sugerido, com justificativa (`tipo_sugerido` guarda o original).
  - Aplicar exige data não futura; a suspensão exige de 1 a 30 dias.
- Não existe papel RH no sistema. O SGNC registra a situação da medida e a aplicação é feita pelo RH, presencialmente.

### 10.5 NC crítica e plano de ação

- "Crítica" é uma marcação separada da criticidade (Baixa/Média/Alta). Só a Qualidade sem conflito marca, depois da validação, com justificativa.
- O plano é alimentado pela Qualidade e pela liderança do colaborador:
  - planejamento: causa raiz, ações, responsável e prazo;
  - execução;
  - acompanhamento: ao menos um registro.
- A conclusão é a verificação de eficácia, feita pela Qualidade, e quem executou o plano não pode concluir. Conclusão leva a NC a `concluida`.
- O colaborador vê o plano em modo leitura; quem só abriu a NC não vê.

### 10.6 Notificações

Tabela `notificacoes` com:

- `evento`;
- `papel_destinatario` (`qualidade`, `acusado`, `lider`, `autor`, `responsavel_acao`, `solicitante`);
- `nivel` (`normal`, `atencao`, `urgente`, `critica`);
- `chave_agrupamento`, `lida_em` e `resolvida_em`.

Regras gerais (R1 a R7):

1. Quem executou a ação nunca é notificado dela.
2. O colaborador da NC nunca recebe a versão "Qualidade" de um evento da própria NC.
3. Uma notificação por pessoa por evento, na ordem acusado > responsável pela ação > líder > quem abriu > Qualidade.
4. Pendências são resolvidas sozinhas quando acabam (o aceite resolve os avisos de aceite).
5. Só notifica quem pode abrir a NC, e o texto não expõe o que a pessoa não pode ver.
6. "Qualidade" = Qualidade e Adm.
7. "Líder" = liderança direta. Em NC crítica, toda a cadeia até a Diretoria.

Matriz resumida:

| Evento | Quem recebe |
|---|---|
| NC aberta | Qualidade, exceto quem abriu e o colaborador analisado |
| NC validada | Qualidade (exceto quem validou), colaborador, líder, quem abriu ("aprovada") |
| NC invalidada | quem abriu ("reprovada", sem o motivo) |
| Feedback | Qualidade (exceto o autor), colaborador (prazo do aceite), líder, responsável pela ação |
| Lembretes do aceite | colaborador; líder nos níveis urgente e crítica |
| Não respondida | colaborador e líder (nível crítica) |
| Prazo da ação (1 dia útil antes) | responsável pela ação |
| NC crítica / plano | colaborador e toda a cadeia; atualizações e conclusão também para a Qualidade |
| Medida passível, aprovada ou reprovada | Qualidade |
| Medida aplicada | Qualidade, colaborador e líder |
| Causa solicitada / decidida | Qualidade / solicitante |

Lembretes do aceite, em horas de expediente. Cada lembrete atualiza a mesma notificação, sobe o nível e volta a ficar não lida:

| Momento | Nível |
|---|---|
| envio do feedback | normal |
| 9h do dia útil seguinte | atenção |
| 4 h de expediente antes do prazo | urgente |
| vencimento | crítica |

E-mail e push estão fora deste ciclo. O navegador consulta `/api/notificacoes` ao carregar a página, ao voltar o foco para a aba e a cada 60 s com a aba visível.

### 10.7 Estrutura organizacional

- Departamentos (com sub-áreas e responsável) e cargos são mantidos pela tela, pela Qualidade e pelo Adm. Nada é apagado: desativar mantém o histórico.
- A troca de liderança só é feita pela aba Equipes (`alterar_equipe_v2`). A RPC:
  - recusa ciclos;
  - recusa mover a Diretoria;
  - limita a troca de perfil a Supervisor ↔ Colaborador.
- A liderança sugerida de uma pessoa é o responsável do departamento dela.

## 11. API (Route Handlers)

Todas as rotas exigem sessão e respondem JSON, exceto os downloads. Os erros seguem `{ detail, campo? }` ou `{ detail, request_id }`.

### NCs

| Método e rota | Função | Quem |
|---|---|---|
| `GET /api/nc` | `listarNcs` | todos (escopo próprio) |
| `POST /api/nc` | `criarNc` | todos |
| `GET /api/nc/minhas` | `listarMinhasNcs` | todos |
| `GET / PUT / DELETE /api/nc/[ncId]` | `buscarNc` / `editarNc` / `excluirNc` | escopo / Qualidade sem conflito |
| `POST /api/nc/[ncId]/avaliar` | `avaliarNc` (`decisao`: `validar` ou `invalidar`, `motivo_invalidacao`) | Qualidade sem conflito |
| `POST /api/nc/[ncId]/feedback` | `aplicarFeedback` | Qualidade sem conflito |
| `POST /api/nc/[ncId]/aceitar` | `aceitarNc` (`texto_aceite`) | colaborador analisado |
| `GET /api/nc/[ncId]/timeline` | `obterTimeline` | escopo |
| `GET /api/nc/[ncId]/reincidencia` | `obterContextoReincidencia` | acesso completo |
| `GET / POST /api/nc/[ncId]/evidencias` | listar / anexar (multipart: `arquivo`, `feedback_id?`) | ver seção 6 |
| `DELETE /api/nc/[ncId]/evidencias/[evidenciaId]` | excluir | Qualidade; autor enquanto `aberta` |
| `POST /api/nc/[ncId]/critica` | `definirCritica` (`critica`, `motivo`) | Qualidade sem conflito |
| `GET / PUT /api/nc/[ncId]/plano-acao` | obter / salvar | ver seção 10.5 |
| `POST /api/nc/[ncId]/plano-acao/acompanhamentos` | registrar acompanhamento | Qualidade, liderança |
| `POST /api/nc/[ncId]/plano-acao/concluir` | verificação de eficácia | Qualidade (não executor) |

### Causas e medidas

| Método e rota | Função |
|---|---|
| `GET /api/nc/causas` | causas ativas (para o formulário) |
| `GET / POST /api/nc/causas/gestao`, `PUT / PATCH / DELETE /api/nc/causas/gestao/[causaId]` | catálogo (Qualidade) |
| `GET / POST /api/nc/causas/solicitacoes`, `POST /api/nc/causas/solicitacoes/decidir` | pedidos de causa |
| `GET /api/nc/medidas-disciplinares?situacao=historico` | medidas pendentes ou histórico (Qualidade) |
| `POST /api/nc/medidas-disciplinares/[medidaId]/decidir` | `decisao`, `motivo`, `tipo?` |
| `POST /api/nc/medidas-disciplinares/[medidaId]/aplicar` | `data`, `dias_suspensao?`, `observacao?` |

### Pessoas, equipes e estrutura

| Método e rota | Função |
|---|---|
| `GET / POST /api/usuarios`, `PUT /api/usuarios/[usuarioId]` | usuários (Adm para criar e editar) |
| `PATCH /api/usuarios/[usuarioId]/desativar`, `/reativar` | acesso (Adm) |
| `POST /api/usuarios/trocar-senha` | troca da própria senha |
| `GET /api/usuarios/opcoes-nc` | colaboradores ativos para o formulário |
| `GET /api/usuarios/[usuarioId]/estatisticas` | estatísticas da pessoa |
| `GET /api/equipe`, `GET /api/equipe/liderancas` | árvore e lideranças |
| `PATCH /api/equipe/[usuarioId]` | troca de liderança e perfil |
| `PATCH /api/equipe/[usuarioId]/posicao` | departamento e cargo |
| `GET /api/equipe/[usuarioId]/ncs`, `/historico` | NCs da pessoa (paginado, 25 por página) e histórico de equipe |
| `GET /api/estrutura`, `POST /api/estrutura/departamentos`, `PATCH .../[departamentoId]`, `POST /api/estrutura/cargos`, `PATCH .../[cargoId]` | estrutura |

### Indicadores, relatórios, notificações e onboarding

| Método e rota | Função |
|---|---|
| `GET /api/insights`, `GET /api/insights/ncs` | indicadores e drill-down (detalhes em [`insights-endpoint.md`](insights-endpoint.md)) |
| `GET /api/relatorios/resumo.pdf` | relatório gerencial |
| `GET /api/relatorios/ncs.xlsx`, `GET /api/relatorios/ncs.csv` | planilhas |
| `GET /api/relatorios/nc/[ncId]` | PDF da NC |
| `GET /api/relatorios/usuarios/[usuarioId]/dossie.pdf` | dossiê |
| `GET /api/notificacoes` | últimas 30, não resolvidas primeiro, com contador |
| `POST /api/notificacoes/[notificacaoId]/lida`, `POST /api/notificacoes/lidas` | marcar como lida |
| `GET /api/onboarding/me` e `POST .../iniciar`, `dispensar`, `concluir`, `restaurar`, `revisar`, `etapas/[chave]/concluir` | primeiros passos |

## 12. Interface

- **Layout autenticado** (`src/app/(app)/layout.tsx`): menu lateral (`AppNavigation.jsx`) com os grupos Operação, Análise e Cadastros; sino de notificações; "Guia" (reabre a apresentação); perfil e sair.
  - Desktop: menu recolhível, com a preferência guardada no cookie `sg-nav`.
  - Tablet em retrato: trilho de ícones.
  - Celular: menu sobreposto.
- **Componentes por área** em `src/features/<área>/components`. Os serviços de cliente (`*Service.js`) chamam a API por `src/lib/api/client/api.js`, que transforma respostas de erro em `ErroApi` (com `campo` e `request_id`).
- **Erros de formulário:** o erro com `campo` vai para o campo correspondente, a página rola e foca o primeiro campo com problema, e o topo lista os campos a revisar. Erro 5xx mantém o formulário preenchido e mostra a referência de suporte.
- **Detalhe da NC** (`DetalhesNcPage.jsx`):
  - trilha de etapas (`EtapasNc`);
  - painéis por papel: `PainelAvaliar`, `PainelFeedback`, `PainelAceite`, `PainelPlanoAcao`;
  - seção de feedback (`FeedbackNc`);
  - evidências;
  - histórico (`HistoricoNc`), que mostra "Você", o papel do autor ou "Sistema" na visão restrita.
- **Onboarding** (`src/features/onboarding`): apresentação por perfil e checklist "Primeiros passos", expandido só no primeiro acesso e recolhido depois.
- **Acessibilidade:** navegação por teclado (Esc fecha menus sobrepostos, abas com setas), `aria-*` nos controles, contraste revisado no redesign de 10/2026.

## 13. Relatórios

Código em `src/lib/reports/`. Toda a formatação passa por `formato.ts`:

- status com o nome da tela;
- horário de Brasília;
- duração legível ("2 dias e 3 horas");
- plurais e rótulos de aceite e de medida.

| Arquivo | Conteúdo |
|---|---|
| Resumo em PDF (`resumo-pdf.ts`) | Página 1 com 4 números comparados ao período anterior de mesmo tamanho e "Pede atenção"; páginas seguintes com fluxo e prazos, causas, setores e pessoas, medidas, lista de NCs e "como ler este relatório" |
| PDF da NC (`pdf.ts`) | Dados, feedback, prazo e situação do aceite, andamento com autor |
| Dossiê (`pdf.ts`) | Histórico do colaborador, NCs e medidas |
| Excel (`planilhas.ts` + `xlsx.ts`) | Abas NCs, Causas, Feedback, Linha do tempo, Indicadores e Leia-me; cabeçalho congelado, autofiltro, durações em `[h]:mm` |
| CSV simples (`csv.ts`) | 15 colunas, uma linha por NC; células iniciadas por `=`, `+`, `-` ou `@` são protegidas contra injeção de fórmula |

Regras de escopo:

- Qualidade e Adm veem toda a empresa; o supervisor vê só a própria cadeia (`buildNcTeamScopeFilter`).
- Todo PDF traz no rodapé quem gerou, quando, e "Página X de Y".
- Caracteres fora da fonte, como emoji, viram "?" em vez de derrubar a geração.

## 14. Testes e checks

| Comando | O que roda |
|---|---|
| `npm run lint` | ESLint (`eslint.config.js`, com regras de hooks do React) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | `test:regression` (scripts `test_pr05…test_pr10`, `test_ux_operacao_indicadores`, `test_pr09_onboarding`) + `test:unit` |
| `npm run test:unit` | `tests/*.unit.spec.ts`: permissões, escopo, prazos de expediente, feedback, medidas, notificações, relatórios, segurança |
| `npm run test:api` | `tests/routes.http.spec.ts` (rotas sem sessão) |
| `npm run test:e2e` | `tests/login.browser.spec.ts` em desktop e mobile |

Regras de negócio puras ficam em funções sem banco (`src/lib/permissions/*`, `feedback.ts`, `lembretes.ts`, `causasCatalogo.ts`, `formato.ts`) justamente para serem testadas em unidade.

Mudanças nas RPCs são validadas num Postgres local ou no Supabase dentro de uma transação desfeita ao final. O registro de cada validação está nos planos em `docs/`.

Para gerar amostras dos arquivos durante os testes, use as variáveis `SGNC_PDF_AMOSTRA`, `SGNC_PDF_RESUMO` e `SGNC_XLSX_AMOSTRA`.

## 15. Deploy e operação

- **Vercel:** deploy automático do `main` para produção e um Preview por PR. As funções rodam em `gru1` (`vercel.json`). As variáveis da seção 4 ficam configuradas no projeto da Vercel.
- **Supabase:** projeto `bxnuslxrlmqzytryxzvv` (`sa-east-1`). As migrações são aplicadas em ordem de nome a partir de `supabase/migrations/`, com autorização do responsável. Os jobs do `pg_cron` são criados pelas próprias migrações.
- **Latência:** `scripts/medir-rotas.mjs` mede p50 e p95 das rotas principais (só GET, com aquecimento) e mostra a região pelo cabeçalho `x-vercel-id`.
- **Logs:** erros 5xx registram `request_id` e o tipo do erro, sem dados pessoais. Use o `request_id` informado pelo usuário para localizar o erro nos logs da Vercel.
- **Compatibilidade:** `/api/legacy/*` é reescrito para `/api/*`, para abas abertas antes da renomeação da API.

## 16. Convenções de contribuição

- Uma fase por PR, validada no Preview antes do merge.
- Migrações são aditivas. Valor novo de enum vai numa migração separada (`ALTER TYPE ... ADD VALUE` não roda na mesma transação em que o valor é usado).
- Transições de status passam por RPCs `*_vN` com histórico em `historico_nc`. Para mudar uma regra, crie a próxima versão da RPC em vez de alterar a anterior em uso.
- Toda regra de acesso existe no servidor. A tela só esconde o que o servidor já recusa.
- A Qualidade nunca conduz NC em que é o colaborador analisado (`podeAtuarComoQualidade`).
- Na interface, o perfil `funcionario` aparece como "Colaborador".
- Antes de abrir o PR, rode `npm run lint`, `npm run typecheck` e `npm test`.
- Credenciais de teste e o token de bypass da Vercel nunca entram no repositório.

## 17. Documentos relacionados

| Documento | Assunto |
|---|---|
| [`manual-do-usuario.md`](manual-do-usuario.md) | Uso do sistema por perfil |
| [`plano-retorno-diretoria-2909.md`](plano-retorno-diretoria-2909.md) | Fases 0–6: feedback, aceite, medidas, notificações (matriz completa) |
| [`plano-processo-gestao-nc.md`](plano-processo-gestao-nc.md) | Aderência ao processo da Qualidade (medidas por ciclo; fases futuras) |
| [`plano-estrutura-organizacional.md`](plano-estrutura-organizacional.md) | Diretoria, cadeia de liderança, departamentos e cargos |
| [`plano-relatorios.md`](plano-relatorios.md) | Reformulação dos relatórios |
| [`nc-critica-plano-acao.md`](nc-critica-plano-acao.md) | NC crítica e plano de ação |
| [`insights-endpoint.md`](insights-endpoint.md) | Contrato do endpoint de indicadores |
| [`uat-retorno-diretoria.md`](uat-retorno-diretoria.md) | Roteiro de teste de aceitação |
| [`backlog-melhorias-operacionais.md`](backlog-melhorias-operacionais.md) | Pendências e próximos passos |

Fases ainda não implementadas do processo da Qualidade (ver `plano-processo-gestao-nc.md`):

- procedimento e tipo de NC (cobrança ou orientativa);
- prazo de feedback por criticidade e contenção em 24 h;
- feedback com participantes;
- verificação de eficácia em 30 dias;
- indicadores de efetividade.
