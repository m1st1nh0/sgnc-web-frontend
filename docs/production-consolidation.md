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

Next App Router hospeda autenticação SSR e serviços server-only de NC, usuários, onboarding, analytics e relatórios. A interface ainda é carregada por LegacyApplication/React Router. Endpoints migrados estão em `/api/legacy`; o catch-all retorna 404 e não encaminha para FastAPI. Service role é lida exclusivamente em `src/lib/supabase/admin.ts` com marcador server-only.

## Critérios de release ainda a comprovar

Rotas nativas, suíte de autorização por papel, E2E autenticado, UAT desktop/mobile, inspeção de CSV/PDF/upload/download, Preview do commit final, CI remoto e inventário das variáveis por ambiente. Nenhum resultado autenticado é presumido a partir do build.
