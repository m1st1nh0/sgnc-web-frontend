# Revisão técnica e de conformidade do SGNC (10/10/2026)

Escopo: todo o código do `main` (`878aea4`), as migrações em `supabase/migrations/`, o banco de produção (`bxnuslxrlmqzytryxzvv`, só leitura) e o documento **"Processo de Gestão de Não Conformidades"** (Qualidade, atualizado em 30/09/2026). Objetivo: saber o que está pronto, o que corrigir, o que enxugar e o que precisa existir antes de mudar o projeto de repositório e de infraestrutura.

Legenda de prioridade: **P0** bloqueia a migração ou é bug com impacto no processo · **P1** corrigir antes da entrega · **P2** melhoria/limpeza.

---

## 1. Resumo executivo

| Área | Situação |
|---|---|
| Ciclo básico (registrar → validar/invalidar → feedback → aceite → concluir) | **Pronto e sólido.** Transições atômicas em RPCs com histórico, conflito de interesse checado na API e no banco. |
| NC crítica + plano de ação + verificação de eficácia | **Pronto**, com segregação de funções (quem executa não verifica). |
| Catálogo de causas governado + fila de solicitações | **Pronto.** Falta só a decisão D1 (Qualidade ainda cria causa na abertura/edição). |
| Hierarquia/equipes, papéis Adm × Qualidade | **Pronto**, com histórico de equipes. |
| Conformidade com o documento do processo | **Parcial (~55%).** Faltam conceitos inteiros do processo: origem, procedimento/intranet, NC Orientativa, causa individual × sistêmica, prazos por criticidade, reabertura, escalonamento, janela de 30 dias, regra 3→medida. Ver seção 2. |
| Pronto para migrar de infraestrutura | **Não.** O schema base não está no repositório e há valores do projeto atual fixos no código. Ver seção 3. |
| Testes | **Confiança baixa.** A maioria verifica texto do código-fonte, e 4 suítes verificam um componente que não é mais renderizado. Ver seção 5. |

Números: ~10,5 mil linhas de código (sem CSS e lockfile), 4,6 mil linhas de CSS em 3 arquivos, 52 Route Handlers, 13 tabelas, 19 funções SQL. Produção tem 9 usuários e 11 NCs: o momento de mudar o modelo de dados é agora, antes do volume crescer.

---

## 2. Conformidade com o processo (documento de 30/09)

### 2.1 Matriz por etapa

| Etapa do processo | O que o processo pede | O que o SGNC faz | Situação |
|---|---|---|---|
| 1. Identificar | Fonte: monitoria, auditoria, supervisão, indicador, reclamação validada | Qualquer perfil abre NC; não há campo **origem** | ❌ campo ausente |
| 2. Validar | Evidência suficiente, procedimento na intranet, criticidade; sem procedimento → **NC Orientativa** | Qualidade valida ou invalida (com motivo). Não há "procedimento" nem tipo Orientativa | ⚠️ parcial |
| 3. Registrar | Campos obrigatórios do item 5.2; supervisor **notificado** pelo sistema; status Aberta | Data, chamado, colaborador, setor, causas, descrição, criticidade, evidências. Faltam origem, procedimento + link, gestor responsável gravado na NC. Sem notificação (Fase 5 do plano) | ⚠️ parcial |
| 4. Analisar causa | Até 2 dias úteis (crítica: mesmo dia); classifica **individual × sistêmica** | Não existe etapa nem classificação; prazos não existem | ❌ |
| 5. Feedback | Analista + Gestor, roteiro de 7 pontos, registra data, **participantes**, resumo, posicionamento do colaborador, ação esperada, ciência; prazo 5 d.u. (leve) / 1 d.u. (crítica) | Um texto livre + aceite com frase digitada (ciência). Faltam participantes, posicionamento, ação esperada, prazos. A Fase 4 do plano cobre parte | ⚠️ parcial |
| 6. Definir ação | O que, responsável, prazo; obrigatória na crítica | Plano de ação só na NC crítica, com causa raiz, ações, responsável, prazo | ✅ (crítica) / ❌ (leve com plano opcional) |
| 7. Acompanhar | Cobrança nos prazos; **ações vencidas sinalizadas aos gestores da área** | Registros de acompanhamento existem; não há alerta de prazo vencido | ⚠️ parcial |
| 8. Verificar | **Janela de 30 dias**; eficaz / **não eficaz** | Texto livre de verificação; só existe o caminho "eficaz" (concluir) | ⚠️ parcial |
| 9. Encerrar ou escalar | Status **Encerrada, Reaberta, Escalada** (RH / gestores da área) | Só `concluida`. Não há `reaberta` nem `escalada` | ❌ |

### 2.2 Divergências de regra (exigem decisão do responsável, não foram assumidas)

| # | Regra do processo | Implementação atual | Onde |
|---|---|---|---|
| C1 | **Criticidade Leve × Crítica**, definida pelo analista no registro, muda prazos, participantes e encerramento | Dois conceitos sobrepostos: `criticidade` texto **Baixa/Média/Alta** escolhida por quem abre (qualquer perfil) e `critica` booleano marcado depois pela Qualidade | `AbrirNcPage.jsx:24`, `nao_conformidades.criticidade`, `definir_nc_critica_v1` |
| C2 | **3 NCs da mesma causa → medida**; contador zera após a medida; 3 medidas → suspensão; 3 suspensões → desligamento (RH + Diretoria) | Medida sugerida na **4ª, 7ª, 10ª** ocorrência; 3 advertências → 3 suspensões → "avaliar justa causa"; a API recusa medida antes da 4ª ocorrência; janela móvel de 12 meses em vez de contador que zera | `service.ts:518`, `service.ts:564`, `analytics/service.ts:31` (lógica duplicada) |
| C3 | Só NCs de **cobrança com causa individual** contam; Orientativas e sistêmicas não | Toda NC validada conta | `validar_nc_com_ocorrencias_v2` |
| C4 | NC crítica é **encaminhada ao RH** independentemente da contagem | Não há encaminhamento nem status Escalada | — |
| C5 | Quando a identificação parte do supervisor, a ocorrência é **repassada** ao analista, que registra | Supervisor e colaborador abrem a NC diretamente (a Qualidade valida depois). Funciona como "identificação → validação", mas o "responsável pelo registro" fica sendo quem abriu | `criarNc` |
| C6 | Encerramento da leve **após o feedback registrado** | Leve só encerra com o **aceite** do colaborador (e com o prazo de 2 d.u. da Fase 4) | `aceitar_nc_v3` |
| C7 | SGNC é o **registro único e oficial** de toda a tratativa | A Qualidade pode **excluir** NC (DELETE físico), apagando histórico e evidências em cascata | `excluirNc`, FKs `ON DELETE CASCADE` |

C7 é o único que recomendo mudar sem esperar: trocar exclusão por cancelamento com motivo (status + histórico). Os demais são decisões de negócio.

### 2.3 Indicadores do item 9.1

| Indicador | Situação |
|---|---|
| Volume por área, causa e criticidade | ✅ Insights |
| NCs por causa **individual × sistêmica** | ❌ não há classificação |
| Taxa de reincidência (colaboradores) | ⚠️ existe contagem por colaborador, não a taxa da fórmula |
| Redução das ocorrências (período anterior × atual) | ❌ |
| Efetividade do feedback (sem nova NC da causa em 30 dias) | ❌ |
| Feedback no prazo da criticidade | ❌ (não há prazo) |
| Planos de ação: % no prazo e % eficazes | ❌ |
| Medidas disciplinares por período | ✅ |

---

## 3. Bloqueios para mudar de repositório e infraestrutura (P0)

1. **O schema base não está versionado.** As migrações do repositório começam em 01/10, mas o banco tem migrações desde 29/08 (`pr01_*`, `pr02_recurrence_v2`, `pr03_atomic_workflow_timeline`, `add_fk_performance_indexes`, `onboarding_*`). As tabelas `usuarios`, `nao_conformidades`, `historico_nc`, `evidencias`, `causas`, `nc_causas`, `medidas_disciplinares`, `onboarding_*`, os enums, o schema `private` (`meu_papel`, `e_meu_subordinado`), `criar_nc_com_historico_v3`, `validar_nc_com_ocorrencias_v2`, o bucket `evidencias` e as políticas de Storage **só existem no banco**. Com o repositório de hoje não dá para subir um banco novo.
   → Gerar um baseline (`supabase db dump --schema public,private,storage` ou `pg_dump --schema-only`), salvar como `supabase/migrations/00000000000000_baseline.sql` e provar que ele recria o banco do zero num projeto vazio.
2. **Divergência de nomes de migração.** No banco, as três últimas migrações têm versões `20261009124617`, `20261009133228`, `20261009141256`; no repositório, `20261008120000/121000/122000`. Um `supabase db push` no projeto novo vai tentar reaplicá-las. Alinhar os nomes (ou recomeçar do baseline).
3. **Valores do projeto atual fixos no código:**
   - `src/proxy.ts:7-8`: CSP com `bxnuslxrlmqzytryxzvv.supabase.co`. Num projeto novo, imagens e conexões ao Supabase são bloqueadas. Derivar de `NEXT_PUBLIC_SUPABASE_URL`.
   - `supabase/migrations/20261008122000_papel_qualidade_equipes.sql:11`: UUID do administrador fixo. Inofensivo no banco atual, mas quebra a reprodução. O baseline resolve.
4. **Região.** O banco está em `sa-east-1` e não há `vercel.json` com região (Fase 2.1 do plano). Na infraestrutura nova, definir a região das funções junto com a do banco desde o primeiro deploy.
5. **Inventário de variáveis e segredos.** `.env.example` cobre só o Supabase e termina com um comentário solto ("Remover quando…"). Faltam: região, segredo do job de "Não respondida" (Fase 4.5a), configuração de Auth (proteção de senha vazada **desligada**, segundo o advisor do Supabase), URL do site e redirects de Auth.
6. **`README.md` é o template do Vite.** Substituir por: como rodar, variáveis, como aplicar migrações, como rodar testes, como fazer deploy.

---

## 4. Bugs encontrados

| P | Bug | Onde | Efeito | Correção proposta |
|---|---|---|---|---|
| P0 | NC crítica em plano de ação **não conta** como ocorrência anterior | `validar_nc_com_ocorrencias_v2`: lista de status sem `em_plano_acao` | Reincidência subnotificada justamente nas NCs mais graves; medida disciplinar sugerida fora de hora | Migração nova com `em_plano_acao` (e depois `nao_respondida`, D14) na lista. Centralizar a lista de "status que contam" num lugar só |
| P1 | Senha atual errada na troca de senha **desloga o usuário** | `usuarios/service.ts:492` devolve 401; `api.js:33` trata qualquer 401 como sessão expirada | Usuário digita a senha errada e é jogado para o login | Responder 422 com `campo: "senha_atual"` |
| P1 | Servidor aceita senha nova com 6 caracteres; a interface exige 10 com complexidade | `usuarios/service.ts:485` e `:312` × `senhaPolicy.js` | A política forte é contornável chamando a API direto | Usar `erroSenhaForte` também no servidor (o módulo já é JS puro) |
| P1 | Excluir NC com medida disciplinar dá erro 500 | FK `medidas_disciplinares.nc_id` sem ação, `excluirNc` não trata `23503` | Mensagem genérica | Resolvido junto com C7 (cancelar em vez de excluir) |
| P1 | Exclusão de NC deixa arquivos órfãos no Storage | `excluirNc` apaga linhas em cascata e não remove objetos | Evidências sensíveis ficam no bucket sem dono | Idem C7 |
| P1 | PDF quebra com caracteres fora do WinAnsi (emoji, "→", "≥" na descrição) | `reports/service.ts`, `StandardFonts.Helvetica` | 500 ao baixar o PDF da NC | Embutir uma fonte TTF (`@pdf-lib/fontkit`) ou sanitizar o texto |
| P2 | `requireUser` executado 2 a 4 vezes por requisição (sessão + leitura de `usuarios` a cada vez) | `criarNc → buscarNc`, `contexto → buscarNc`, `obterTimeline → buscarNc`, `listarEvidencias` | Lentidão (ponto 1 da diretoria) | `cache()` em `getUser` (Fase 2.2) |
| P2 | `listarPessoasAbaixo` (BFS com uma consulta por nível) roda várias vezes por requisição do supervisor | `buscarNc`, `lidera`, `reportScope` | Lentidão | `cache()` por requisição ou função SQL recursiva única |
| P2 | `listarNcs`, `gerarCsvNcs` e `obterInsights` carregam **todas** as NCs e filtram em memória | `service.ts:189`, `reports/service.ts:109`, `analytics/service.ts:160` | Não escala | Filtrar período e status no SQL; paginar a lista |
| P2 | Uma consulta por causa ao abrir/editar NC | `causeIds` | Lentidão | `.in("descricao_normalizada", lista)` (Fase 2.3) |

---

## 5. Testes: o que eles provam de verdade

- **4 suítes de regressão verificam um arquivo morto.** `test_pr07.mjs`, `test_pr09_onboarding.mjs`, `test_pr10_hierarchy.mjs` e `test_ux_operacao_indicadores.mjs` leem `src/components/navigation/BarraNavegacao.jsx`, que nenhuma tela importa (a navegação real é `AppNavigation.jsx`). Elas passam mesmo se a navegação real quebrar.
- **A maior parte dos testes é busca de texto no código-fonte** (`readFileSync` + `assert.match`/`toContain`), não comportamento. Ex.: `tests/nc-edit.unit.spec.ts` confere se a string `rpc("editar_nc_v3"` existe. Qualquer refatoração quebra esses testes sem haver bug, e bugs reais passam (o P0 de reincidência passa em todas as suítes).
- **Bons testes que valem manter e ampliar:** `nc-scope`, `plano-acao-permissions`, `evidence-permissions`, `papeis-equipes`, `team-hierarchy`, `retorno`, `report-period` (testam funções puras) e `routes.http.spec.ts` (testa a API sem sessão).
- **`npm test` não roda num clone limpo:** `test:unit` sobe `next start`, que exige `next build`. O CI faz o build antes; localmente falha. Os testes unitários não precisam de servidor; separar o `webServer` só para os projetos `http` e `e2e`.
- **`test_pr11_cause_governance.mjs` roda no CI mas não no `npm test`.**
- **Não há teste contra banco.** As regras críticas (transições, reincidência, segregação) vivem em SQL e não têm teste automatizado. Recomendação: testes de banco com `supabase start` + pgTAP, ou testes de integração Playwright contra um banco descartável.

---

## 6. Enxugar: o que descartar

Removível sem efeito em produção (nenhum import encontrado). **Feito em 10/10 neste PR:** os quatro arquivos, os três helpers e o rewrite `/api/legacy`; os quatro testes agora verificam `AppNavigation.jsx`, e `test_pr11` entrou no `npm test`. Continuam pendentes `enviar_nc_legada_v3`, os status legados, as políticas RLS legadas e a reorganização de docs e testes.

| Item | Linhas |
|---|---|
| `src/components/navigation/BarraNavegacao.jsx` (navegação antiga; retargetar os 4 testes para `AppNavigation.jsx`) | 137 |
| `src/components/ui/ModalConfirmacao.jsx` | 39 |
| `src/components/ui/Cartao.jsx` | 14 |
| `src/lib/supabase/client.ts` (o navegador não fala mais com o Supabase) | 20 |
| `requireApiAdmin`, `requireApiQualidade` (`lib/auth/api.ts`), `requirePermission` (`lib/auth/session.ts`) | ~10 |
| Rewrite `/api/legacy/:path*` em `next.config.ts` (o próprio comentário diz "remove after cutover") e o teste dele | ~5 |
| Função SQL `enviar_nc_legada_v3` (nenhum uso no código) | — |
| Status legados `validada` e `aguardando_analise`: não há NCs nesses status em produção; o código os trata em ~10 lugares (`canonical`, `FILTER_STATUS_ALIASES`, `STATUS_INFO`, RPCs). Migrar e simplificar | ~40 |
| Política RLS `nc_select_escopo` e funções `private.*`: a leitura direta foi revogada em 07/10; as políticas ficam como "defesa em profundidade" mas divergem da regra real (`nc-scope.ts:4-7`). Decidir: manter alinhadas ou remover | — |
| Docs de PRs antigos (`pr05-*.md`, `migration-*.md`, `production-consolidation.md`): mover para `docs/historico/` | — |
| `test_pr*.mjs` na raiz: mover para `tests/` | — |

### Duplicação a consolidar

- **Regra de medida sugerida** escrita duas vezes (`nc/service.ts:518` e `analytics/service.ts:31`). Vai mudar com C2: deixar uma única função, de preferência em SQL junto com a contagem.
- **"Status que contam" / "status ativos" / "status visíveis"** repetidos em `nc-scope.ts`, `analytics/service.ts`, `service.ts:248`, `reports/service.ts`, `statusNc.js` e nas RPCs. Criar um módulo `lib/nc/status.ts` como fonte única (e uma função SQL equivalente).
- **Normalização de descrição de causa** em três lugares (`causeIds`, `solicitarCausa`, `normalizarDescricaoCausa`) além da coluna gerada no banco.
- **Mapas de erro de RPC** em três arquivos (`transitionError`, `ERROS` do plano, `ERROS` de equipes). Um único `rpcOuErro(nome, params, mapa)`.
- **CSS:** `bootstrap.min.css` + `index.css` (2.051 linhas) + `redesign.css` (2.499) + `dashboard.css`; 59 seletores definidos nos dois arquivos grandes, 34 `!important`. Consolidar num só arquivo de tokens + componentes; avaliar sair do Bootstrap (`react-bootstrap` aparece em 31 arquivos, sobretudo `Container`, `Modal`, `Form`).

---

## 7. Qualidade do código: o que melhorar

- **`src/lib/reports/service.ts` e `analytics/service.ts` estão "minificados à mão"** (linhas de 400 a 1.000+ caracteres, várias instruções por linha). São os arquivos mais difíceis de revisar e onde estão as regras dos indicadores. Reescrever em funções pequenas com testes; boa parte dos cálculos pode ir para SQL (views ou funções), o que também resolve o "carregar tudo".
- **TypeScript frouxo:** `strict: false`, 17 `as any` sobre o cliente Supabase e a maior parte da interface em `.jsx`. Gerar os tipos do banco (`supabase gen types`) e tipar o `createAdminClient`; isso elimina os `as any` e pega erro de coluna em tempo de build.
- **Toda leitura usa o service role** e a autorização está na API. É uma escolha válida (está documentada), mas significa que um erro de filtro na API vaza dados. Mitigação: manter os testes de escopo e centralizar os filtros (já existe `nc-scope.ts`); nunca usar `select("*")` em rota que devolve dados a perfis restritos.
- **Telas grandes:** `InsightsPage.jsx` (922), `DetalhesNcPage.jsx` (720), `RelatoriosPage.jsx` (448), `AbrirNcPage.jsx` (413). Dividir por seção; o detalhe carrega NC e evidências em sequência e espera o onboarding (`DetalhesNcPage.jsx:130, 174`).
- **Erros sem campo:** `ApiError` não carrega o campo com problema (Fase 1.2 do plano).
- **Mensagens com nomes técnicos para o usuário:** "supervisor_id é obrigatório para papel 'funcionario'…", "papel inválido.", "decisao deve ser 'validar' ou 'invalidar'".

---

## 8. Plano sugerido

Ordem pensada para a entrega e a migração. Cada linha vira um PR (convenção do projeto).

| Ordem | PR | Conteúdo | Depende de |
|---|---|---|---|
| 1 | **Baseline do banco** (P0) | Dump do schema + Storage como migração inicial, alinhamento das versões, prova em projeto vazio, `README` real, `.env.example` completo, CSP a partir da variável | — |
| 2 | **Correções** (P0/P1) | Reincidência com `em_plano_acao`, troca de senha (422 + política forte no servidor), PDF com fonte Unicode | — |
| 3 | **Enxugar** | Remoções da seção 6, testes retargetados para `AppNavigation.jsx`, `npm test` sem build, `test_pr11` no `npm test` | — |
| 4 | Fases 1 a 6 do plano da diretoria | Como está em `plano-retorno-diretoria-2909.md` | 1–3 |
| 5 | **Conformidade com o processo** | Após as decisões C1–C7: origem, procedimento + link, tipo (cobrança/orientativa), causa individual/sistêmica, criticidade Leve/Crítica única, prazos por criticidade, reabertura, escalonamento (RH/gestores), janela de 30 dias, novos indicadores | decisões |
| 6 | **Refatoração estrutural** | `lib/nc/status.ts`, `rpcOuErro`, tipos gerados, reescrita de relatórios/insights, CSS único, testes de banco | pode correr em paralelo a 5 |

### Decisões do responsável (10/10/2026)

| ID | Divergência | Decisão |
|---|---|---|
| D16 (C1) | Criticidade | **Unificar em Leve/Crítica**, mantendo a regra atual do plano de ação: NC crítica exige plano de ação e verificação de eficácia. Em aberto: o que fazer com o Baixa/Média/Alta das NCs existentes (proposta: Alta → Crítica só se já marcada como crítica; demais → Leve, com o valor antigo preservado no histórico). |
| D17 (C2) | Medida disciplinar | **Regra do documento, contando ocorrências em 12 meses:** 3 NCs da mesma causa → medida e o contador zera (histórico mantido); 3 medidas → suspensão; 3 suspensões → desligamento avaliado por RH e Diretoria. |
| D18 (C3/C4) | Novos campos e status | **Sim:** tipo da NC (cobrança/orientativa), natureza da causa (individual/sistêmica) e status Reaberta e Escalada. Orientativas e sistêmicas não entram na contagem do D17. |
| D19 (C5) | Quem registra | **Supervisor e colaborador continuam abrindo NC diretamente**; a Qualidade avalia se procede (valida) ou não (invalida). |
| D20 (C6) | Encerramento da NC leve | **No aceite do feedback** pelo colaborador (mantém D5/D11). |
| D21 (C7) | Exclusão de NC | **Trocar por cancelamento com motivo**, registrado no histórico. Nada é apagado. |
| D22 | Prazos das demais etapas | **Mostrar e avisar (opção B).** Prazos de contenção (crítica, 24h), análise (2 d.u.; crítica no mesmo dia), feedback (leve 5 d.u.; crítica 1 d.u.), plano de ação e verificação (30 dias) aparecem no detalhe e no painel e entram nos indicadores "Feedback no prazo" e "Planos de ação no prazo". Perto de vencer ou vencido, o sino avisa a Qualidade responsável; ação de plano vencida avisa também os gestores da área. Só o prazo do aceite muda o status sozinho ("Não respondida"). |
