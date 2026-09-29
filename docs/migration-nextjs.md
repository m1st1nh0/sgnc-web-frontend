# Migração SGNC para Next.js

## Escopo e segurança da migração

- Repositório de destino: `m1st1nh0/sgnc-web-frontend`.
- Branch de trabalho: `refactor/nextjs-fullstack`, criada a partir de `main` em 2026-09-29.
- Repositório de referência `m1st1nh0/sgnc-web-api` mantido intacto.
- Princípio: preservar comportamento, regras, permissões e conteúdo antes de qualquer melhoria visual.
- Estado: auditoria e fundação Next.js implementadas localmente; autenticação SSR ainda não conectada ao fluxo. Os commits locais não foram publicados porque o ambiente não disponibilizou credenciais de push Git.

## Arquitetura atual

React 19 + Vite + React Router 7 + React Bootstrap/Bootstrap 5 + Recharts são implantados na Vercel. O backend Python FastAPI usa Supabase Auth, PostgREST e Storage, e está implantado no Render. O cliente usa `VITE_API_URL` ou fallback `https://sgnc-web-api.onrender.com`; o bearer token é mantido em `localStorage`. A API usa cliente anon autenticado pelo bearer para operações protegidas por RLS e `SUPABASE_SERVICE_ROLE_KEY` para operações internas privilegiadas.

## Arquitetura futura

Next.js App Router + TypeScript + Node.js Runtime na Vercel, com Supabase Auth SSR baseado em cookies. Leituras via Server Components/services, mutações via Server Actions quando adequadas, e Route Handlers para binários, uploads, downloads e integrações HTTP. Browser usa somente anon key; server usa sessão/RLS; admin/service role fica restrito ao servidor. Supabase permanece como banco, Auth e Storage.

## Inventário funcional do frontend

Rotas declaradas no `src/App.jsx`:

- `/login` — autenticação.
- `/trocar-senha` — troca da senha provisória.
- `/` — dashboard/home.
- `/abrir-nc` — abertura de não conformidade.
- `/nc/:id` — detalhes, exclusão e fluxo de aceite/avaliação.
- `/nc/:id/editar` — edição (ADM).
- `/usuarios` — administração de usuários (ADM).
- `/insights` — métricas gerenciais (ADM/supervisor).
- `/relatorios` — relatórios gerenciais (ADM/supervisor).
- `/usuarios/:usuarioId/dossie` e `/usuarios/:usuarioId/estatisticas` — estatísticas individuais.

Componentes/contextos notáveis: `AuthContext`, `OnboardingContext`, modal/checklist/dicas de onboarding, navegação, feedback, avaliação, aceite, modal de medida disciplinar, upload/visualização de evidências e gráficos Recharts. Serviços: auth, NC, usuário, onboarding, insights, relatórios. Assets/CSS: `public/`, `src/index.css`, `src/App.css`, `src/redesign.css`.

Chamadas ainda dependentes da API estão centralizadas em `src/services/api.js` (`chamarApi`, `baixarArquivoApi`) e consumidores `ncService.js`, `usuarioService.js`, `authService.js`, `onboardingService.js`, `insightsService.js`, `relatoriosService.js`; `DetalhesNcPage.jsx` também chama a exclusão via `chamarApi`. Uploads multipart e downloads binários usam a API.

## Inventário do backend e cadeia ativa

`app/main.py` monta os routers `auth_router`, `nc_router`, `usuario_router`, `evidencia_router`, `insights_router`, `relatorios_router`, `onboarding_router`.

- Autenticação/perfil: `POST /auth/login` → `auth_router.py` → Supabase Auth + `usuarios`; consumidor `LoginPage`/`authService` → destino SSR Auth e service de perfil.
- Senha: `POST /usuarios/trocar-senha` → `usuario_router.py` → `usuario_service.py` + Supabase Auth/`usuarios`; `TrocarSenhaPage` → Server Action.
- Usuários: `GET/POST /usuarios`, `GET /usuarios/opcoes-nc`, `PUT /usuarios/{id}`, `PATCH /usuarios/{id}/desativar|reativar` → `usuario_service.py`; `GET /usuarios/{id}/estatisticas` → `estatisticas_service_v2.py`; consumidor `UsuariosPage`, páginas home/NC e `EstatisticasUsuarioPage` → `usuario.service.ts` e `estatisticas.service.ts`.
- NC: `GET/POST /nc`, `GET/PUT/DELETE /nc/{id}`, `GET /nc/causas`, `POST /nc/{id}/avaliar|feedback|aceitar`, compatibilidade `POST /nc/{id}/enviar`, `POST /nc/medidas-disciplinares` → router usa efetivamente `nc_service_pr03.py` (confirmado por import direto), schemas em `schemas_nc.py`; principais tabelas `nao_conformidades`, `nc_causas`, `causas`, `medidas_disciplinares`, `usuarios`, `historico_nc`; consumidores `HomePage`, `AbrirNcPage`, `EditarNcPage`, `DetalhesNcPage`, `ncService.js` → `nc.service.ts` e Server Actions.
- Timeline: `GET /nc/{id}/timeline` → endpoint NC chama `nc_service_pr03.obter_timeline`, que delega a `timeline_service.obter_timeline`; `timeline_service.py` lê `historico_nc`; consumidor de detalhes → `timeline.service.ts`.
- Evidências: `GET/POST /nc/{id}/evidencias`, `DELETE /nc/{id}/evidencias/{evidencia_id}` → `evidencia_service.py` + Supabase Storage e tabela `evidencias`; consumidor modal de evidências/detalhes → Route Handlers ou fluxo Storage seguro.
- Insights: `GET /insights?inicio&fim` → router injeta `insights_service_v2` no contrato PR04 e chama `insights_service_pr04.py`; usa `nao_conformidades`, `medidas_disciplinares`, `usuarios`; consumidor `InsightsPage` → `insights.service.ts`.
- Relatórios: `GET /relatorios/ncs.csv`, `/relatorios/resumo.pdf`, `/relatorios/nc/{id}.pdf`, `/relatorios/usuarios/{id}/dossie.pdf` → `relatorios_service.py` e `relatorio_documentos.py`; tabelas NC, usuários, causas, medidas, evidências, histórico conforme operação; consumidor `RelatoriosPage`/estatísticas/detalhes → `relatorios.service.ts` e Route Handlers.
- Estatísticas: endpoint de usuário chama `estatisticas_service_v2.py`, tabelas `usuarios`, `nao_conformidades`, `nc_causas`, `medidas_disciplinares`; consumidor `EstatisticasUsuarioPage` → `estatisticas.service.ts`.
- Onboarding: `GET /onboarding/me`, e `POST /me/iniciar`, `/me/etapas/{chave}/concluir`, `/me/dispensar`, `/me/concluir`, `/me/restaurar`, `/me/revisar` → `onboarding_service.py` + schemas e tabelas `onboarding_execucoes`, `onboarding_etapas`; consumidor `OnboardingContext`/componentes → `onboarding.service.ts`.

## Matriz endpoint → serviço → dados → consumidor → destino

| Endpoint FastAPI | Serviço ativo | Dados principais | Consumidor | Destino Next |
|---|---|---|---|---|
| `POST /auth/login` | `auth_router.py` | Supabase Auth, `usuarios` | Login | Supabase SSR + `auth.service.ts` |
| `POST /usuarios/trocar-senha` | `usuario_service.py` | Supabase Auth, `usuarios` | Trocar senha | Server Action |
| `GET/POST /usuarios`, `GET /usuarios/opcoes-nc`, `PUT/PATCH /usuarios/*` | `usuario_service.py` | `usuarios`, Auth Admin | Usuários, abertura NC | `usuario.service.ts` + actions |
| `GET /usuarios/{id}/estatisticas` | `estatisticas_service_v2.py` | NC, causas, medidas, usuários | Estatísticas/dossiê | service + Route Handler PDF |
| `/nc*` e `/nc/{id}/*` | `nc_service_pr03.py` | NC, causas, vínculos, medidas, usuários, histórico | Home, abrir, editar, detalhes | `nc.service.ts` + actions |
| `/nc/{id}/evidencias*` | `evidencia_service.py` | Storage, `evidencias`, NC | Modal/detalhes | service + Route Handlers/Storage |
| `/insights` | `insights_service_v2.py` + `insights_service_pr04.py` | NC, medidas, usuários | Insights | `insights.service.ts` |
| `/relatorios/ncs.csv`, `/relatorios/resumo.pdf` | `relatorios_service.py` | NC e tabelas relacionadas | Relatórios | service + Route Handlers |
| `/relatorios/nc/{id}.pdf`, `/relatorios/usuarios/{id}/dossie.pdf` | `relatorio_documentos.py` | NC/usuário, evidências, histórico | Detalhes/estatísticas | Route Handlers + PDF Node |
| `/onboarding/me*` | `onboarding_service.py` | Execuções e etapas | Contexto/modal/checklist | `onboarding.service.ts` + actions |
| `GET /nc/{id}/timeline` | `nc_service_pr03.obter_timeline` → `timeline_service.obter_timeline` | `historico_nc` | Detalhes | `timeline.service.ts` |

## Versões legadas identificadas

- NC ativo no router: `nc_service_pr03.py`; `nc_service.py`, `nc_service_pr02.py`, `nc_service_v2.py` não são selecionados pelo router atual. Investigar diferenças/histórico antes de descartar qualquer regra.
- Insights ativo: `insights_service_pr04.py`, com cliente sincronizado a `insights_service_v2.py`; `insights_service.py`, `insights_service_pr02.py` e uso direto alternativo de V2 não são a chamada final do endpoint.
- Estatísticas ativa: `estatisticas_service_v2.py`.
- Onboarding ativo: `onboarding_service.py` com conteúdo/manifesto `onboarding_manifesto.py`.
- Timeline ativo por rota é `nc_service_pr03.obter_timeline` → `timeline_service.obter_timeline` e `calcular_duracoes`.
- Recorrência: `recurrence_v2.py` é importado por `estatisticas_service_v2.py`, `insights_service_pr04.py`, além de versões históricas; faz parte das métricas ativas.

## Checklist por módulo

- [x] Fundação Next.js 16 App Router/TypeScript, CSS/assets e lint/build; páginas antigas movidas para `src/legacy` e carregadas temporariamente no cliente.
- [ ] Rotas individuais Next e remoção completa do React Router (temporariamente mantido dentro do app legado).
- [ ] Supabase SSR e autenticação por cookie (dependência e clientes browser/server/admin implementados; login/logout e sessão ainda não conectados às páginas).
- [ ] Autorização centralizada, usuário ativo e senha provisória (helpers `requireUser`, `requireRole`, `requirePermission` criados; ainda não aplicados às rotas).
- [ ] Usuários e hierarquia.
- [ ] NCs e fluxos (criar, editar, avaliar, feedback, aceitar, medidas, recorrência).
- [ ] Timeline e histórico.
- [ ] Evidências (upload/listagem/exclusão/download e permissões).
- [ ] Estatísticas e comparação com respostas Python.
- [ ] Insights e comparação de métricas.
- [ ] Onboarding e progresso.
- [ ] CSV e PDFs; comparação de estrutura/conteúdo com ReportLab.
- [ ] Remover React Router, Vite, `VITE_API_URL`, URLs Render e chamadas FastAPI.
- [ ] Preview Vercel validado nos fluxos críticos.

## Riscos, pendências e decisões

- Risco alto de regressão em regras complexas de NC, métricas e escopo hierárquico: comparar serviços ativos e usar dados/fixtures equivalentes.
- Migração de ReportLab para Node pode gerar diferenças de paginação/fontes/imagens; requer comparação dos documentos.
- Cliente service role ignora RLS e deve permanecer isolado em módulos server-only com autorização explícita antes de operações privilegiadas.
- A criação/edição de usuário envolve Supabase Auth Admin e exige service role; não pode ser executada no browser.
- Nenhuma divergência entre produção e código foi validada; deploy/segredos Supabase e preview ainda não verificados. O legado permanece temporariamente acoplado ao React Router e à API até a migração de autenticação/domínios.
- Lista temporária de dependência FastAPI permanece marcada pendente até conversão de cada módulo.

## Estado da dependência externa

A configuração atual contém `VITE_API_URL` e fallback `https://sgnc-web-api.onrender.com`; existem ainda chamadas do frontend para rotas FastAPI. Migração não concluída. API antiga permanece como referência e não foi alterada. A fundação ainda tem o fallback legado ativo em `src/legacy/services/config.js`.


## Próximos passos detalhados

A sequência abaixo mantém a produção atual operante enquanto cada domínio ganha paridade no Next.js. Cada PR deve ser pequeno o bastante para revisão e possuir validação própria. O PR #21 é o checkpoint inicial, está em rascunho e já contém auditoria, fundação Next e scaffolding de Supabase SSR.

### PR #21 — Fundação e auditoria (em andamento)

- Revisar a estrutura App Router e confirmar o preview Vercel.
- Preservar o fallback legado temporariamente; não remover a API nem as configurações Render ainda.
- Corrigir avisos lint quando o código legado relacionado for tocado.
- Critério: preview compila, entrega rotas legadas existentes, configurações de build são reproduzíveis e documentação descreve corretamente o estado.

### PR seguinte — Autenticação, autorização e roteamento Next

1. Configurar as variáveis Supabase no ambiente Preview Vercel sem copiar valores secretos para o Git ou logs.
2. Implementar login/logout com `@supabase/ssr`, cookies seguros e validação no servidor; buscar o perfil `usuarios` por RLS.
3. Preservar mensagens e condições para usuário sem cadastro, inativo e com senha provisória; a troca de senha permanece acessível antes da liberação das funções.
4. Aplicar helpers de autorização a cada rota/action/handler; não confiar apenas no client-side nem chamar service role antes da autorização.
5. Criar rotas App Router individuais equivalentes às dez rotas existentes e adaptar `Link`, navegação, parâmetros e query strings.
6. Adicionar testes para sessão ausente/expirada, perfil ativo/inativo, papéis e senha provisória.
- Critério: login, logout, redirecionamentos e papéis são validados no Preview; nenhum token fica em localStorage; cada rota bloqueada no servidor.

### PR — Usuários e hierarquia

- Migrar listagem global/equipe/próprio perfil, opções de colaboradores, criação, edição, desativação, reativação e troca de senha.
- Manter operações de Auth Admin no servidor, isoladas em `admin.ts`; validar escopo ADM/supervisor/funcionário e vínculos de supervisão.
- Critério: testes de permissão e comparação de payloads do serviço Python; fluxos administrativos testados com contas de Preview apropriadas.

### PR — Núcleo de NCs e timeline

- Portar a implementação ativa `nc_service_pr03.py`, schemas e dependências usadas, com `recurrence_v2.py` e `timeline_service.py` onde aplicável.
- Migrar leitura/listagem, causas, abertura e edição; depois status, avaliação, feedback, aceite, medidas, exclusão e recorrência preservando transições/validações atuais.
- Separar regras em `nc.service.ts`, `timeline.service.ts` e actions/handlers adequados; manter queries privilegiadas somente no servidor.
- Criar testes de regras por transição, autorização, filtros, recorrência e sequência cronológica do histórico.
- Critério: mesmos dados de entrada em fixtures aprovadas para API e Next geram resultados equivalentes; UI não chama FastAPI para NC.

### PR — Evidências e Storage

- Portar listagem, upload múltiplo quando suportado, metadata, associação e exclusão; respeitar permissões de leitura/escrita da NC.
- Preferir upload autenticado direto ao Supabase Storage com política adequada; usar Route Handler para validar autorização e metadados quando o fluxo exigir mediação.
- Preservar download/visualização e associação de cada arquivo.
- Critério: testes de tipo/tamanho, acesso negado, múltiplos arquivos, falha parcial e exclusão consistente; validar no Preview.

### PR — Estatísticas e Insights

- Portar `estatisticas_service_v2.py`, `insights_service_v2.py` + `insights_service_pr04.py` e `recurrence_v2.py` ativo.
- Criar fixtures determinísticas para datas, estados, supervisores, subordinados e recorrência; comparar cada métrica e agregação com Python.
- Critério: igualdade das métricas e escopos para os mesmos dados, incluindo limites de período e fuso/data; nenhuma consulta client-side privilegiada.

### PR — Onboarding

- Portar `onboarding_service.py`, schemas e manifesto; preservar início, progresso, conclusão de etapas, dispensa, revisão e restauração.
- Validar idempotência e estado da execução do usuário, sem alterar conteúdo ou regra de conclusão.
- Critério: testes de sequência/progresso e conferência visual do modal/checklist.

### PR — CSV, PDFs e relatórios

- Portar filtros e escopos de `relatorios_service.py`; manter CSV compatível com Excel e filtros de data/status/colaborador/setor.
- Migrar PDFs de `relatorio_documentos.py` para runtime Node usando solução selecionada após prova de compatibilidade; conteúdo, evidências, histórico, permissões e nome de arquivo devem ser comparados com amostras ReportLab.
- PDF resumo, PDF NC e dossiê individual devem ter comparação visual e de conteúdo, incluindo paginação e Unicode.
- Critério: testes autorizados/negados, filtros, conteúdo obrigatório e arquivos abertos corretamente no Preview.

### PR final — Remover a API antiga da aplicação

- Substituir/remover todos os consumidores FastAPI, `react-router-dom`, Vite, `VITE_API_URL`, `API_BASE_URL` e URLs Render.
- Atualizar CSP para remover Render e permitir somente origens efetivamente necessárias do Supabase; manter headers de segurança.
- Remover CORS/rewrite Vite antigo e dependências/ferramentas não usadas. A API antiga permanece intacta como histórico até validação e autorização posterior.
- Executar busca global de `sgnc-web-api.onrender.com`, `VITE_API_URL`, `react-router-dom`, `BrowserRouter` e `vite`; todas devem retornar zero ocorrências ativas.
- Critério de encerramento: Preview Vercel validado em todos os papéis e fluxos, testes críticos/lint/build passam, uploads/CSV/PDF confirmados e nenhum request FastAPI na rede do navegador/servidor. Só então concluir o PR e produzir `docs/migration-final-report.md`.

### Regras de execução compartilhadas

- Atualizar este documento no mesmo PR que cada domínio migrado.
- Em cada PR, rodar `npm run lint`, `npm run typecheck`, `npm run build` e testes do domínio; registrar avisos e falhas sem ocultá-los.
- Usar dados sintéticos ou anonimizados nos testes comparativos; não inserir tokens, service role ou dados pessoais em fixtures.
- Não alterar schema/RLS sem mapear a política e justificar necessidade. Mudanças de schema/RLS devem ser isoladas, revisáveis e acompanhadas de teste de regressão.
- Manter feature flags/roteamento temporário apenas durante a transição e retirar cada chamada FastAPI assim que a paridade do módulo estiver comprovada.
