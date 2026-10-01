# Consolidação Next.js — registro de execução

## Baseline

- Base: `f53cf52283a0663fdfb29abc7d3cbca0d476539e` (PR #28).
- Branch: `refactor/nextjs-production-ready`.
- Preview da base: `dpl_6qe4Xxs7uCW83QeRvuUD2zFia2mX`, READY.
- Rollback informado: `dpl_91955HjfLrkriGttMfY89eSdXSuf` (preservar).
- Produção não promovida durante a consolidação.

## Goal 1 — baseline técnico

Correções: caminhos de regressão atualizados após a migração; expectativas de autenticação por cookie e CSP Next atualizadas; typecheck incluído no CI; workflows aplicados também a PRs empilhados e branches de consolidação; patch transitivo de brace-expansion.

Verificações locais: npm ci, seis scripts de regressão, typecheck e build aprovados. Lint sem erros com três warnings históricos. npm audit sem vulnerabilidades após patch. Essas regressões incluem verificações estáticas e não substituem E2E autenticado.

## Arquitetura observada

Next App Router hospeda páginas autenticadas, APIs em `/api/*` e serviços server-only de NC, usuários, onboarding, analytics e relatórios. Os antigos endpoints `/api/legacy/*` reescrevem temporariamente para as rotas novas para suportar abas abertas durante a transição. Não há encaminhamento para FastAPI. Service role é lida exclusivamente em `src/lib/supabase/admin.ts` com marcador server-only.

## Critérios de release ainda a comprovar

E2E autenticado e UAT desktop/mobile, inspeção de CSV/PDF/upload/download, correção da configuração do Preview e inventário das variáveis por ambiente. Nenhum resultado autenticado é presumido a partir do build.

## Goal 2 — rotas nativas (implementação local)

As nove rotas autenticadas agora possuem page.tsx e layout compartilhado com providers. Login e troca de senha permanecem nativos. React Router, LegacyApplication e catch-all de SPA foram removidos. Next Link/useRouter/useParams substituem navegação anterior; guards por papel executam no servidor. Build, typecheck e seis regressões passam.

Os testes HTTP verificam redirecionamento das rotas profundas sem sessão e recusas 401 para endpoints sensíveis. Verificação visual ainda bloqueada no ambiente: agent-browser não inicia o daemon; download Chromium retorna arquivo inválido; navegador cloud não permite localhost (ERR_BLOCKED_BY_CLIENT). Portanto esta etapa não possui aprovação de UAT.

## Goal 3 — organização

Componentes e clientes de auth, NC, users, onboarding, insights e reports separados em `src/features`. UI reutilizável e navegação em `src/components`; helpers compartilhados em `src/lib`. `src/legacy` foi removido; os componentes preservam conteúdo e classes CSS. Removidos assets de starter sem referência e App.css contendo apenas comentários. CSS global restante preservado porque a verificação visual ainda está bloqueada.

## Goal 4 — backend e segurança

APIs movidas para `/api/*`; clientes usam `/api`. Rewrite temporário de `/api/legacy/*` preserva abas abertas e deve ser removido após UAT do cutover. Autorização de sessão/API centralizada e tipada; perfis inválidos/inativos são rejeitados. Listagem de NC passa a aplicar a mesma ocultação de campos do detalhe; PDF usa timeline autorizada. CSV neutraliza fórmulas, upload vazio é rejeitado e JSON inválido recebe 422. Logs de erros inesperados não incluem mais a mensagem bruta.

Testes locais: 26 verificações unitárias de sessão/autorização/privacidade/formato e 17 verificações HTTP de redirects, autenticação, JSON inválido, rotas desconhecidas e headers; total 43 aprovados. `npm run test:e2e` está configurado para CI, mas a execução local não é possível porque o Chromium disponível está ausente/corrompido.

## Bloqueios de release encontrados

- A consulta somente leitura confirmou que `authenticated` pode executar SELECT direto em `public.nao_conformidades` e `public.historico_nc`. As leituras da aplicação foram movidas para os serviços server-only com escopo por perfil; a migração `supabase/migrations/20261001000000_revoke_direct_nc_reads.sql` revoga o acesso Data API de `anon` e `authenticated`. Aplicar somente depois de implantar a versão que usa as rotas Next; a migração ainda não foi aplicada ao banco compartilhado.
- O Security Advisor do Supabase relata proteção contra senhas vazadas desativada. O responsável aceitou temporariamente seguir sem esse controle; registrar a exceção, revisar após o lançamento e manter os demais controles de autenticação ativos.
- O UAT autenticado dos perfis supervisor e funcionário foi concluído. Ainda faltam administrador, abertura/edição, feedback/aceite, PDF/CSV e upload/download.
- PR #29 aberta em rascunho, empilhada sobre a branch da PR #28. Os workflows remotos Frontend checks e Security checks passaram; Vercel criou Preview READY para o commit `45cae83` (`dpl_cTq9hKPULvyYUYPey7g1k2EtJe57`).
- O Preview de `94e98eb` está READY após a correção das variáveis de ambiente. `/login` responde HTTP 200 e os logs runtime recentes não registram erros. Falta repetir o smoke da raiz e executar UAT autenticado/visual quando houver sessão de teste.
- A produção continua no deployment Vite `c19fc...`; rollback `dpl_91955HjfLrkriGttMfY89eSdXSuf` foi preservado. Nenhum deployment foi promovido.

## Estado dos goals

Goals 1–4 implementados; a migração de revogação direta continua pendente de aplicação coordenada após o cutover para as rotas Next. A branch inclui a correção de escopo e o drill-down local descritos abaixo. Build, typecheck, lint, regressões, unitários e HTTP passaram localmente; CI e Preview do commit mais recente estão em andamento. A exceção temporária de senha vazada foi aceita e registrada. Goals 6–7 (RC, release/cutover) continuam bloqueados por UAT funcional restante, revisão do Preview e coordenação da migração de banco.


## UAT autenticado do Preview (01/10/2026)

- Supervisor: login concluído; painel da equipe, Insights, Relatórios e detalhe da NC abriram. O painel exibiu 2 NCs visíveis/1 ativa; Insights exibiu 4 registradas no período/3 no backlog ativo. A divergência pode decorrer de recortes diferentes, mas precisa ser reconciliada antes de liberar drill-down de indicadores. Os gráficos e cards do Insights não expõem ações de clique para listar as NCs correspondentes.
- Funcionário: login concluído; painel pessoal carregou sem Insights/Relatórios no menu. Acesso direto a `/nc/9` (registro visível ao supervisor) mostrou “NC não encontrada”; navegação direta a `/insights` retornou ao painel.
- Nenhum registro de NC foi criado, editado ou excluído durante o UAT. Ambos os perfis foram desconectados ao final.
- Ainda faltam UAT com administrador, fluxos de abertura/feedback/aceite, PDF/CSV, anexos e verificação visual mobile.

Correção de escopo implementada na branch e ampliada para respeitar também NCs abertas pelo próprio supervisor. O drill-down foi iniciado; após publicar no Preview, confirmar se painel e Insights reconciliam e se listas/modal apresentam os mesmos registros dos indicadores.

## Drill-down de indicadores (implementação local)

- Cards de backlog/volume e gráficos de etapa, aging, mês, causa, colaborador, setor e criticidade agora abrem um modal paginado com as NCs correspondentes e link para o detalhe.
- O endpoint novo `/api/insights/ncs` exige papel administrador/supervisor e reaplica o escopo de leitura do servidor. As rotas de Insights e CSV usam também a regra de autoria da política.
- Typecheck, lint (sem erros; warnings históricos), build, regressões, 23 testes unitários e 24 testes HTTP passaram localmente. `npm run test:e2e` não executou porque Chromium não está instalado neste ambiente; precisa de smoke visual no Preview/CI.
- A implementação ainda está apenas na árvore de trabalho local; publicar na branch do PR #29, aguardar Preview e conferir por UAT que contagens e listas batem, especialmente barras empilhadas e períodos personalizados.

## Revisão adicional do mapa operacional

O anexo trouxe melhorias de desempenho, governança de causas, acompanhamento de NC, mensagens de erro, hierarquia/equipe, acesso ao histórico individual, período de relatório de 30 dias e controles de navegação. A revisão técnica, estado atual, critérios de aceite e ordem de implementação estão em [`backlog-melhorias-operacionais.md`](./backlog-melhorias-operacionais.md). O candidato mensurável para lentidão é a consulta sem limite de NCs/causas antes do filtro temporal em `obterInsights`; o módulo Relatórios é somente de exportação e usa 12 meses por padrão. As observações numeradas sobre navegação não identificam a tela/controle e precisam ser mapeadas em UAT antes de alterar a interface.
