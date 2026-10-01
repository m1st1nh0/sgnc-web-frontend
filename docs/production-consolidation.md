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

E2E autenticado e UAT desktop/mobile, inspeção de CSV/PDF/upload/download, Preview do commit final, CI remoto e inventário das variáveis por ambiente. Nenhum resultado autenticado é presumido a partir do build.

## Goal 2 — rotas nativas (implementação local)

As nove rotas autenticadas agora possuem page.tsx e layout compartilhado com providers. Login e troca de senha permanecem nativos. React Router, LegacyApplication e catch-all de SPA foram removidos. Next Link/useRouter/useParams substituem navegação anterior; guards por papel executam no servidor. Build, typecheck e seis regressões passam.

Os testes HTTP verificam redirecionamento das rotas profundas sem sessão e recusas 401 para endpoints sensíveis. Verificação visual ainda bloqueada no ambiente: agent-browser não inicia o daemon; download Chromium retorna arquivo inválido; navegador cloud não permite localhost (ERR_BLOCKED_BY_CLIENT). Portanto esta etapa não possui aprovação de UAT.

## Goal 3 — organização

Componentes e clientes de auth, NC, users, onboarding, insights e reports separados em `src/features`. UI reutilizável e navegação em `src/components`; helpers compartilhados em `src/lib`. `src/legacy` foi removido; os componentes preservam conteúdo e classes CSS. Removidos assets de starter sem referência e App.css contendo apenas comentários. CSS global restante preservado porque a verificação visual ainda está bloqueada.

## Goal 4 — backend e segurança

APIs movidas para `/api/*`; clientes usam `/api`. Rewrite temporário de `/api/legacy/*` preserva abas abertas e deve ser removido após UAT do cutover. Autorização de sessão/API centralizada e tipada; perfis inválidos/inativos são rejeitados. Listagem de NC passa a aplicar a mesma ocultação de campos do detalhe; PDF usa timeline autorizada. CSV neutraliza fórmulas, upload vazio é rejeitado e JSON inválido recebe 422. Logs de erros inesperados não incluem mais a mensagem bruta.

Testes locais: 26 verificações unitárias de sessão/autorização/privacidade/formato e 17 verificações HTTP de redirects, autenticação, JSON inválido, rotas desconhecidas e headers; total 43 aprovados. `npm run test:e2e` está configurado para CI, mas a execução local não é possível porque o Chromium disponível está ausente/corrompido.

## Bloqueios de release encontrados

- A consulta somente leitura de privilégios confirmou que `authenticated` pode executar SELECT direto em `public.nao_conformidades` e `public.historico_nc`. Como as políticas de linha não ocultam colunas, a supressão feita pela API Next não protege contra Data API direta. É necessária uma migração explícita de privilégios/visões, revisada com compatibilidade e UAT antes do corte.
- O Security Advisor do Supabase relata proteção contra senhas vazadas desativada. Alterar essa configuração pode afetar cadastro e troca de senha; permanece pendente de decisão do responsável pelo produto.
- Sem credenciais de usuários de teste, não foi possível validar fluxo autenticado por papel, upload/download ou documentos gerados. Não solicitar nem guardar credenciais em chat.
- Não há Preview ou execução de CI para o commit final porque as alterações ainda estão somente no clone local. O revisor automático bloqueou o `git push` por considerar o envio de código-fonte a um destino externo não verificado uma divulgação de dados sem autorização explícita nesta conversa. Não foi feita nova tentativa.
- A produção continua no deployment Vite `c19fc...`; rollback `dpl_91955HjfLrkriGttMfY89eSdXSuf` foi preservado. Nenhum deployment foi promovido.

## Estado dos goals

Goals 1–4 implementados localmente, com a remediação de banco e UAT ainda pendentes. Goal 5 tem cobertura unitária/HTTP automatizada e CI configurado, mas aguarda execução remota e E2E autenticado. Goals 6–7 (RC, release/cutover) permanecem bloqueados pelos itens acima e não devem avançar até os gates serem aprovados.
