# Plano: reformulação dos relatórios

Fonte: arquivos exportados em 13/10/2026 (`sgnc-resumo-2026-09-14-2026-10-13.pdf` e `sgnc-ncs-2026-09-14-2026-10-13.csv`) e o gerador em `src/lib/reports/service.ts`. Protótipos discutidos com o responsável em 13/10/2026 (página "Novos relatórios SGNC").

## Goal

> **Os relatórios do SGNC são lidos pela diretoria e pela Qualidade sem tradução: português com acento, datas e horários de Brasília, tempos escritos como se fala, status com o nome da tela, e cada arquivo diz quem gerou, quando e com qual recorte. O resumo em PDF abre pelo que pede ação e detalha o período nas páginas seguintes; a planilha permite análise por causa, feedback e linha do tempo.**

O goal está concluído quando:

1. Nenhum dos três PDFs (resumo, NC, dossiê) nem a planilha mostra texto sem acento, data ISO, horário UTC, status interno (`aguardando_feedback`) ou horas decimais para leitura.
2. Todo PDF traz no rodapé quem gerou, quando, e "Página X de Y". O resumo diz o escopo (empresa ou equipe) e os filtros aplicados.
3. Texto digitado pelo usuário com caractere fora da fonte (emoji, seta) não derruba a geração do PDF.
4. O resumo gerencial segue a proposta B, com a proposta A como página 1, e compara os 4 números da página 1 com o período anterior de mesmo tamanho.
5. O botão principal de exportação gera um Excel com as abas NCs, Causas, Feedback, Linha do tempo, Indicadores e Leia-me. O CSV continua disponível em versão simples (proposta C).
6. Lint, typecheck e `npm test` passam, e cada fase foi validada no Preview com Qualidade e supervisor.

## Diagnóstico

| Problema | Onde | Evidência |
|---|---|---|
| Texto sem acento | Os três PDFs e o cabeçalho do CSV | "Nao respondidas", "AUTOMACAO", "Descricao". A Helvetica padrão do `pdf-lib` (WinAnsi) aceita acentos do português. |
| Datas e horários de banco | Resumo e CSV | Período "2026-09-14 a 2026-10-13"; `Prazo do aceite` = `2026-10-13T21:00:00+00:00` (é 18:00 em Brasília). |
| Tempos em horas decimais | Resumo e CSV | "validacao ate feedback: 0.01 h (3 amostras)"; "1 amostras". |
| Nomes internos | Resumo, NC, dossiê e CSV | Status `aguardando_feedback`; chaves `criacao_ate_validacao`; metodologia "snapshot ocorrencia_numero > 1"; medidas `advertencia`, `sugerida`. |
| `'-` no CSV | CSV | O rótulo "-" de NC sem feedback passa por `csvCell`, que prefixa `'` em texto que começa com "-". |
| Sem contexto do recorte | Os três PDFs | Não dizem quem gerou, quando, escopo, filtros nem número de página. |
| Caractere fora da fonte derruba o PDF | Os três PDFs | `drawText` lança erro para emoji ou seta digitados na descrição ou no feedback. |
| Planilha não permite análise | CSV | NC com várias causas vira texto separado por vírgula; feedback e linha do tempo ficam de fora ou achatados. |

## Decisões

Respondidas pelo responsável em 13/10/2026 ("siga conforme as sugestões"):

| ID | Pergunta | Decisão |
|---|---|---|
| R-D1 | Formato do resumo em PDF | **Relatório completo (proposta B)** com o resumo de uma página (proposta A) como página 1. |
| R-D2 | CSV, Excel ou os dois | **Excel com abas (proposta D) no botão principal** e o CSV mantido em versão simples (proposta C). |
| R-D3 | Comparar com o período anterior | **Sim, só nos 4 números da página 1.** O período anterior tem o mesmo número de dias e termina na véspera do início. |
| R-D4 | Nomes de colaboradores no resumo | **Qualidade e Adm veem nomes de toda a empresa; supervisor vê só os da própria cadeia** (mesmo escopo do resto do sistema). |
| R-D5 | PDF da NC e dossiê | **Recebem as correções da Fase R1 agora.** O redesenho do dossiê fica para depois. |

## Fases

Uma fase por PR, validada no Preview antes do merge.

### Fase R1: correções nos três PDFs e no CSV

- [x] Formatação compartilhada em `src/lib/reports/formato.ts`: status com o nome da tela, datas e horários de Brasília, duração legível, plural, rótulos de aceite e de medida.
- [x] PDFs com acento, rótulo em negrito, rodapé "Gerado por … em …" e "Página X de Y".
- [x] Texto fora da fonte é trocado por "?" em vez de derrubar o PDF.
- [x] Resumo: período em dd/mm/aaaa, escopo e filtros, tempos legíveis com plural, metodologia em português simples.
- [x] PDF da NC: status com nome da tela, andamento com data, hora e autor.
- [x] Dossiê: status, situação e tipo de medida com nome da tela.
- [x] CSV: cabeçalho com acento, status com nome da tela, datas e horários de Brasília, situação do aceite vazia quando não há feedback.
- [x] Testes de unidade da formatação.
- [ ] Validado no Preview (Qualidade e supervisor).

### Fase R2: relatório gerencial em PDF (propostas A + B)

- [ ] Página 1: 4 números com comparação ao período anterior, "Pede atenção" (aceites vencendo, reincidência com medida sugerida, NC parada há mais tempo), etapas, tempos e principais causas.
- [ ] Páginas seguintes: fluxo e prazos (NCs por mês, idade do backlog, aceites), causas, setores e pessoas (R-D4), medidas disciplinares, lista das NCs do período, "como ler este relatório".
- [ ] Gráficos de barra desenhados com `pdf-lib`, sem dependência nova.
- [ ] Testes de unidade da montagem de "Pede atenção" e da comparação de períodos.
- [ ] Validado no Preview (Qualidade e supervisor).

### Fase R3: planilhas (propostas C + D)

- [ ] Excel com abas NCs, Causas, Feedback, Linha do tempo, Indicadores e Leia-me; cabeçalho congelado, autofiltro, durações em `[h]:mm`.
- [ ] CSV simples com 15 colunas: etapa atual, dias na etapa, líder direto, causa e ocorrência, prazo e situação do aceite, medida sugerida, link.
- [ ] Botão principal "Baixar Excel" e "CSV simples" como opção secundária na tela de relatórios.
- [ ] Dependência nova para gerar `.xlsx` no servidor, avaliada antes de entrar.
- [ ] Validado no Preview (Qualidade e supervisor).

### Depois deste ciclo

- Redesenho do dossiê do colaborador no mesmo padrão visual do resumo (R-D5).
