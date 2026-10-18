# SGNC Web Frontend

Sistema de Gestão de Não Conformidades (SGNC), desenvolvido para registrar, acompanhar e conduzir não conformidades dentro da empresa, desde a abertura até a conclusão do processo.

O sistema apoia as áreas de Qualidade, liderança, colaboradores e administração, oferecendo controle de permissões, histórico das etapas, feedback estruturado, aceite do colaborador, planos de ação, notificações, indicadores e relatórios.

> **Status:** em processo de validação final em pré-produção.

## Origem do projeto

O projeto nasceu a partir de uma oportunidade identificada dentro da empresa.

Um colega estava tentando criar uma aplicação para gerenciar as não conformidades da organização, mas estava encontrando dificuldades para evoluir a solução. Nesse momento, ofereci ajuda para transformar a ideia em uma aplicação funcional.

A primeira versão foi construída rapidamente com apoio de Inteligência Artificial, utilizando uma planilha como banco de dados local e uma interface baseada em CustomTkinter. Essa versão inicial foi apresentada ao diretor da empresa, que aprovou a ideia e incentivou sua evolução.

A partir desse retorno, o projeto passou por algumas fases importantes:

1. **Protótipo inicial:** aplicação desktop criada com IA, CustomTkinter e uma planilha como banco local.
2. **Primeira versão web:** migração para uma aplicação web com API em FastAPI, reaproveitando os contratos e regras já estabelecidos no protótipo inicial.
3. **Evolução arquitetural:** migração gradual para uma aplicação 100% Next.js, buscando reduzir a latência, simplificar a operação e aproximar a aplicação do banco de dados.
4. **Versão atual:** aplicação full-stack em Next.js, integrada ao Supabase e preparada para validação final em ambiente de pré-produção.

## Principais funcionalidades

- Abertura de não conformidades por diferentes perfis de usuário.
- Catálogo controlado de causas de não conformidade.
- Avaliação, validação ou invalidação de uma NC pela Qualidade.
- Feedback estruturado com:
  - causa raiz;
  - ação combinada;
  - responsável pela ação;
  - prazo da ação;
  - registro do combinado.
- Aceite formal do colaborador, com controle de prazo em horário de expediente.
- Identificação de NCs não respondidas após o vencimento do prazo.
- Histórico completo das transições, com autor, data e horário.
- Classificação de NCs críticas e criação de planos de ação.
- Acompanhamento de reincidência por colaborador e causa.
- Controle de medidas disciplinares em etapas.
- Notificações internas sobre pendências e mudanças de etapa.
- Gestão de usuários, equipes, departamentos, cargos e hierarquia de liderança.
- Dashboards com indicadores e insights operacionais.
- Exportação de dados em PDF, Excel e CSV.
- Controle de acesso por perfil e escopo organizacional.
- Upload e consulta de evidências anexadas às NCs.
- Onboarding e checklist de primeiros passos por perfil.

## Fluxo principal de uma NC

```text
Aberta
  ↓
Avaliação
  ↓
Feedback
  ↓
Aceite
  ├──→ Concluída
  └──→ Plano de ação, quando a NC é crítica
```

Quando o prazo de aceite vence, a NC pode passar para o status **Não respondida**. O colaborador ainda pode registrar o aceite posteriormente, que ficará identificado como realizado fora do prazo.

## Perfis de acesso

| Perfil | Responsabilidades principais |
|---|---|
| **Colaborador** | Abrir NCs, acompanhar seus registros, consultar o dossiê e registrar aceite. |
| **Supervisor** | Acompanhar as NCs da sua cadeia de liderança, indicadores e planos de ação da equipe. |
| **Qualidade** | Avaliar NCs, registrar feedback, conduzir planos de ação, administrar causas e medidas disciplinares. |
| **Administrador** | Todas as permissões da Qualidade, além da administração de usuários e acessos. |

Uma regra importante do sistema é que ninguém pode conduzir uma NC contra si próprio. Quando o colaborador analisado pertence à Qualidade, outra pessoa autorizada deve conduzir o processo.

## Arquitetura

A aplicação utiliza uma arquitetura full-stack baseada no Next.js:

```text
Navegador
   │
   │ chamadas HTTP /api/...
   ▼
Next.js 16 na Vercel
   ├── App Router e páginas autenticadas
   ├── Route Handlers da API
   ├── Server Actions
   ├── Regras de negócio e permissões
   └── Proxy de sessão e segurança
        │
        ▼
Supabase
   ├── Auth
   ├── PostgreSQL
   ├── RPCs e triggers
   ├── pg_cron
   └── Storage privado para evidências
```

As rotas da API ficam em `src/app/api` e delegam as regras de negócio para os serviços localizados em `src/lib`. As transições mais sensíveis do fluxo são executadas por funções versionadas no PostgreSQL, garantindo validação de permissões, consistência transacional e registro de histórico.

## Stack tecnológica

- **Next.js 16** com App Router e Route Handlers.
- **React 19**.
- **TypeScript** e JavaScript/JSX.
- **Supabase** para autenticação, banco de dados e armazenamento de arquivos.
- **PostgreSQL** com RPCs, triggers e `pg_cron`.
- **React Bootstrap** e Bootstrap para componentes de interface.
- **CSS próprio** para o design e responsividade.
- **Recharts** para gráficos e indicadores.
- **pdf-lib** para geração de documentos PDF.
- **Playwright** para testes unitários, HTTP e navegador.
- **Vercel** para deploy da aplicação.

## Estrutura do projeto

```text
src/
├── app/
│   ├── (app)/          Páginas autenticadas da aplicação
│   ├── api/            Route Handlers da API
│   ├── actions/        Server Actions, como login e logout
│   ├── login/          Tela de autenticação
│   └── trocar-senha/   Fluxo de troca da senha provisória
├── components/
│   ├── graficos/       Componentes de gráficos
│   ├── navigation/     Navegação e menu principal
│   └── ui/             Componentes visuais reutilizáveis
├── features/           Funcionalidades organizadas por domínio
│   ├── auth/
│   ├── insights/
│   ├── nc/
│   ├── notificacoes/
│   ├── onboarding/
│   ├── reports/
│   └── users/
├── lib/                Regras de negócio, serviços e integrações
└── proxy.ts            Renovação de sessão e políticas de segurança

supabase/
└── migrations/         Migrações do banco e funções PostgreSQL

tests/                  Testes unitários, HTTP e de navegador
scripts/                Scripts auxiliares, incluindo medição de rotas
docs/                   Documentação técnica, manuais e planos de evolução
```

## Requisitos

- Node.js compatível com a versão do Next.js utilizada no projeto.
- npm.
- Um projeto Supabase configurado.
- As migrações de `supabase/migrations` aplicadas no banco.

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as variáveis abaixo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica

# Compatibilidade com projetos que ainda utilizam a chave anon legada
# NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon

# Usada somente no servidor. Nunca exponha essa chave ao navegador.
SUPABASE_SERVICE_ROLE_KEY=sua-chave-de-service-role
```

O arquivo `.env.example` contém um modelo dessas configurações.

## Instalação e execução local

```bash
# Instalar dependências
npm install

# Iniciar o ambiente de desenvolvimento
npm run dev
```

A aplicação ficará disponível em:

```text
http://localhost:3000
```

Para executar uma versão de produção localmente:

```bash
npm run build
npm run start
```

## Testes e validações

```bash
# Lint
npm run lint

# Verificação de tipos
npm run typecheck

# Testes de regressão e unitários
npm test

# Testes unitários
npm run test:unit

# Testes HTTP da API
npm run test:api

# Testes de navegador em desktop e mobile
npm run test:e2e
```

Antes de executar os testes do Playwright que utilizam o servidor de produção local, faça o build da aplicação:

```bash
npm run build
npm run test:e2e
```

## Segurança

O projeto possui algumas camadas de proteção para autenticação e acesso aos dados:

- Sessão integrada ao Supabase Auth.
- Controle de permissões no servidor.
- Proteção contra condução de uma NC pelo próprio colaborador analisado.
- Content Security Policy com nonce por requisição.
- Headers de segurança configurados no `next.config.ts`.
- Service role do Supabase utilizada somente no servidor.
- Storage privado para evidências, com URLs assinadas.
- Respostas de erro 5xx sem exposição de detalhes técnicos ao usuário.
- Registro de `request_id` para rastreamento de erros no ambiente de produção.

## Deploy

O deploy é realizado na Vercel. O projeto utiliza a região `gru1`, buscando manter a aplicação próxima da infraestrutura do banco e reduzir a latência das requisições.

As migrações do banco ficam versionadas em `supabase/migrations` e devem ser aplicadas em ordem antes da disponibilização de novas funcionalidades que dependam delas.

## Documentação

A pasta `docs` contém materiais complementares do projeto:

- `docs/documentacao-tecnica.md` — arquitetura, regras de negócio, API e operação.
- `docs/manual-do-usuario.md` — manual de uso por perfil.
- `docs/uat-retorno-diretoria.md` — roteiro de validação de aceitação.
- `docs/plano-retorno-diretoria-2909.md` — plano de evolução baseado no retorno da diretoria.
- `docs/insights-endpoint.md` — contrato do endpoint de indicadores.
- `docs/backlog-melhorias-operacionais.md` — melhorias e próximos passos.

## Próximos passos

O foco atual é concluir a validação final em pré-produção, contemplando:

- testes de aceitação com os diferentes perfis de usuário;
- validação das notificações e dos fluxos de aprovação;
- conferência dos relatórios e exportações;
- medições finais de latência;
- validação dos cenários desktop e mobile;
- preparação para a operação em produção.

## Contexto de desenvolvimento

Este projeto também representa uma evolução prática de uma solução criada de forma incremental: começou como um protótipo desktop apoiado por IA e uma planilha, passou por uma API em FastAPI e chegou a uma arquitetura full-stack em Next.js.

Essa evolução foi guiada por três objetivos principais:

- transformar uma necessidade real da empresa em uma solução utilizável;
- preservar e evoluir os contratos e regras de negócio já validados nas versões anteriores;
- melhorar desempenho, segurança, manutenção e capacidade de crescimento da aplicação.
