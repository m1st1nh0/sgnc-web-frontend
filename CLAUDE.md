# SGNC: memória do projeto

Sistema de Gestão de Não Conformidades. Next.js 16 full-stack (Route Handlers em `src/app/api`, regras em `src/lib`), Supabase (projeto `bxnuslxrlmqzytryxzvv`, região `sa-east-1`), deploy na Vercel a partir do `main`. Código, textos de interface e commits em português.

## Goal atual

**Fechar os 9 pontos levantados pela diretoria em 29/09/2026.** O plano completo, com diagnóstico, decisões em aberto, fases, critérios de conclusão e checklist, está em [`docs/plano-retorno-diretoria-2909.md`](docs/plano-retorno-diretoria-2909.md). Leia esse arquivo antes de trabalhar em qualquer item dele e marque os checkboxes conforme cada fase avançar.

Resumo das fases:
0. Linha de base: região das funções na Vercel e medição das rotas.
1. Correções rápidas: causa só do catálogo, erros apontando o campo, primeiros passos recolhidos, botão de próxima ação filtrando.
2. Desempenho: região `gru1`, `cache()` na sessão, causas em lote, sem esperar onboarding.
3. Acompanhamento: etapas da NC e linha do tempo no detalhe.
4. Feedback estruturado: causa raiz, ação, responsável, prazo, reincidência visível, aceite ou contestação.
5. UAT nos três perfis e devolutiva para a diretoria.

Decisões D1 a D6 do plano precisam de resposta do responsável antes das fases indicadas. Não assuma as recomendações como aprovadas.

## Convenções

- Uma fase por PR, validada no Preview antes do merge.
- Migrações de banco são aditivas e ficam em `supabase/migrations/`. Valor novo de enum vai numa migração separada.
- Transições de status passam por RPCs `*_vN` com histórico em `historico_nc`. Não atualize status direto pela API.
- A Qualidade nunca conduz NC em que é o colaborador analisado (`podeAtuarComoQualidade`).
- Checks: `npm run lint`, `npm run typecheck`, `npm test`.
