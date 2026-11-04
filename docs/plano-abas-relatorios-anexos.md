# Plano: abas internas, relatórios e anexos

Entrega única (as cinco etapas do plano saíram no mesmo PR, por decisão do responsável em 03/11/2026).

## Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| A1 | O que é "Erros apontados" nos relatórios? | **A descrição da NC**, como registrada na abertura. Não é um campo novo e não muda a interface de abertura/edição, que continua com "Descrição". |
| A2 | Como entregar as 5 etapas? | **Um PR só**, contrariando a regra de "uma fase por PR" por escolha do responsável. |
| A3 | O que vira aba interna? | Só os **módulos do menu** visíveis para o perfil. Telas de detalhe (`/nc/12`, `/equipe/abc`) não abrem aba própria: a primeira fica na aba de onde o usuário veio, a segunda pertence à aba do módulo `/equipe`. |

## Etapa 1 e 2 — abas internas, persistência e fechamento

- `src/lib/utils/abas.js`: regra pura das abas (qual módulo responde por uma rota, abrir, normalizar, fechar, escopos de rascunho, leitura/gravação no `localStorage`). Testável sem navegador.
- `src/components/navigation/BarraAbas.jsx`: a barra, renderizada pelo `AppNavigation` dentro do `<main>`.
- `src/components/navigation/icones.jsx`: os ícones saíram do `AppNavigation` para serem usados também pelas abas.
- Visual (decisão de 04/11/2026, versão V1 das três estudadas): a aba ativa se funde com a faixa em vez de flutuar como caixa; as inativas não têm borda, só um fio entre vizinhas, que some em volta da ativa; o × aparece na ativa, no hover e com foco de teclado; o excesso ganha contador "+N" e setas, que só aparecem quando a lista não cabe. A faixa tem 39px.
- Cada aba guarda **a última URL visitada no módulo**. Como filtros, busca e paginação ficam na query string, voltar para a aba devolve o contexto sem estado extra.
- As abas são gravadas por usuário (`sgnc-abas:<id>`) e restauradas no carregamento; na restauração, aba de módulo inexistente, sem permissão ou com URL de outro módulo é descartada. Limite de 12 abas.
- Fechar a aba ativa leva para a seguinte (ou a anterior, se era a última); sem abas restantes, volta para `/`.
- Fechar uma aba de formulário com rascunho (`abrir-nc`, `editar-nc:<id>`, `feedback-nc:<id>`) pede confirmação. O rascunho em si continua guardado pelo `useRascunho`.

## Etapa 3 — chamado e erros apontados nos relatórios

| Formato | Chamado | Erros apontados |
| --- | --- | --- |
| PDF gerencial (`resumo-pdf.ts`) | coluna nova na lista de NCs | coluna nova, texto encurtado em 160 caracteres (`encurtar`, em `pdf.ts`) |
| PDF da NC (`service.ts`) | já existia | seção "Erros apontados" (era "Descrição") |
| Excel (`planilhas.ts`) | já existia | coluna "Erros apontados" na aba NCs (era "Descrição") |
| CSV simples (`planilhas.ts`) | já existia | coluna nova; o CSV passou de 15 para 16 colunas |
| Tela de relatórios | coluna nova | coluna nova, com o texto completo no `title` |

O campo veio do banco pelo `select` de `dados.ts` (já tinha `chamado` e `descricao`); a lista da tela ganhou `descricao` em `analytics/drilldown.ts`. O CSV continua neutralizando fórmulas (`csvCell`), então descrição com `=`, aspas ou quebra de linha sai íntegra e inofensiva.

## Etapa 4 — arrastar e colar imagens

- `src/lib/nc/anexos.js`: formatos, limite de 15 MB, mensagens, deduplicação e nome da imagem colada. **A API usa as mesmas regras** (`src/lib/nc/evidence.ts` passou a importar daqui), então o que o formulário aceita é o que o servidor aceita.
- `src/components/ui/AreaAnexos.jsx`: seleção pelo campo, arrastar e soltar, e colar com Ctrl+V, com miniatura das imagens, remoção e aviso de formato/tamanho/duplicado. A zona é focável e abre o seletor com Enter ou Espaço.
- Usada em **Abrir NC**, **Detalhes da NC** (anexo da abertura, agora com vários arquivos de uma vez) e **Registrar feedback**. O envio continua pelo fluxo atual (`anexarEvidencia`, permissões e bucket `evidencias`).

## Etapa 5 — acessibilidade, responsividade e testes

- Barra de abas: `nav` com nome acessível, `aria-current="page"` na ativa, botão de fechar com rótulo próprio, foco visível e navegação por setas/Home/End. Rola na horizontal e estreita no celular.
- Área de anexos: rótulo, texto de ajuda associado, confirmação em `aria-live` e erro em `role="alert"`.
- Testes: `tests/abas-internas.unit.spec.ts`, `tests/anexos-evidencias.unit.spec.ts`, acréscimos em `tests/relatorios-r1.unit.spec.ts` e `tests/relatorios-r3.unit.spec.ts`, e `tests/layout-responsivo.browser.spec.ts` (desktop, tablet e celular nas telas sem sessão).
- As telas internas exigem sessão: abas e anexos ainda precisam de **validação manual no Preview**, nos três perfis e nos três tamanhos.
