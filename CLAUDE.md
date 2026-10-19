# SGNC: memória do projeto

Sistema de Gestão de Não Conformidades. Next.js 16 full-stack (Route Handlers em `src/app/api`, regras em `src/lib`), Supabase (projeto `bxnuslxrlmqzytryxzvv`, região `sa-east-1`), deploy na Vercel a partir do `main`. Código, textos de interface e commits em português.

## Goal atual

**Fechar os 9 pontos levantados pela diretoria em 29/09/2026.** O plano completo, com diagnóstico, decisões em aberto, fases, critérios de conclusão e checklist, está em [`docs/plano-retorno-diretoria-2909.md`](docs/plano-retorno-diretoria-2909.md). Leia esse arquivo antes de trabalhar em qualquer item dele e marque os checkboxes conforme cada fase avançar.

Resumo das fases:
0. Linha de base: região das funções na Vercel e medição das rotas.
1. Correções rápidas: causa só do catálogo, erros apontando o campo, primeiros passos recolhidos, botão de próxima ação filtrando.
2. Desempenho: região `gru1`, `cache()` na sessão, causas em lote, sem esperar onboarding.
3. Acompanhamento: etapas da NC e linha do tempo no detalhe.
4. Feedback estruturado, aceite com prazo de 2 dias úteis e status "Não respondida".
4B. Medida disciplinar em etapas.
5. Notificações dentro do aplicativo (tabela + consulta pela API), conforme a matriz da Fase 5.
6. UAT nos três perfis e devolutiva para a diretoria.

Decisões do responsável (09/10/2026), valem como regra:
- Causa nova só é cadastrada em `/causas`. Abertura e edição de NC nunca criam causa, para nenhum perfil.
- "Primeiros passos" recolhido por padrão depois do primeiro acesso.
- Feedback: causa raiz, ação combinada, responsável pela ação, prazo da ação e combinado são obrigatórios; anexo de evidências é opcional.
- Não há contestação do feedback por enquanto.
- O colaborador tem 2 dias úteis após o envio do feedback para o aceite, contados **só dentro do expediente** (segunda a sexta, 9h–18h, sem feriados) = 18 horas de expediente; envio fora do expediente começa a contar às 9h do próximo dia útil. O aceite continua exigindo a frase digitada.
- Vencido o prazo, a NC muda automaticamente para o status "Não respondida" (com histórico), e o colaborador analisado e o supervisor dele recebem notificação.
- Depois de "Não respondida", o colaborador ainda pode registrar o aceite (com a frase); o aceite fica marcado como "aceito fora do prazo".
- A Qualidade não é notificada quando uma NC fica "Não respondida".
- Quem abriu a NC recebe só a decisão (aprovada ou reprovada); na abertura, só a confirmação na tela.
- Avisos de etapa: notificações dentro do aplicativo (sem e-mail neste ciclo).

- Aviso de NC nova vai para todos com papel Qualidade ou Adm, exceto quem abriu e quem for o colaborador analisado. O acusado só é avisado na validação, mesmo sendo da Qualidade.
- NC "Não respondida" conta como ocorrência para reincidência.
- Notificações seguem a matriz e as regras R1–R7 da Fase 5 do plano. Líder = supervisor direto; em NC crítica, toda a cadeia. Lembretes só de segunda a sexta, 9h–18h, com níveis normal → atenção → urgente → crítica.
- Medida disciplinar tem etapas (sugerida → aprovada/reprovada → aplicada) e só pode ser decidida ou aplicada por alguém da Qualidade que não seja o colaborador da NC.
- Na interface, o papel "Funcionário" se chama **"Colaborador"**. O valor interno `funcionario` no banco e na API não muda.

Estrutura organizacional (decisões de 11/10/2026, plano em [`docs/plano-estrutura-organizacional.md`](docs/plano-estrutura-organizacional.md)):
- Todos têm liderança, inclusive Qualidade e Adm, exceto os membros da Diretoria (`usuarios.diretoria`), que ficam no topo. Pode haver mais de um membro da Diretoria.
- Perfil é permissão; posição é a liderança. A cadeia de liderança passa por qualquer pessoa com liderados.
- O diretor (CEO) tem perfil Supervisor no topo. NC crítica avisa toda a cadeia até a Diretoria; as demais, só o líder direto.
- Troca de liderança só pela aba Equipes. Departamentos, cargos e lideranças são mantidos pela tela (a empresa está em expansão).

Processo de Gestão de NCs da Qualidade (decisões de 13/10/2026, plano em [`docs/plano-processo-gestao-nc.md`](docs/plano-processo-gestao-nc.md)):
- Criticidade continua Baixa/Média/Alta; "crítica" é marcação separada, feita só depois da validação.
- Prazos (retomados em 18/10): análise de causa em 2 dias úteis (crítica: no mesmo dia), feedback em 5 dias úteis (crítica: 1 dia útil) e contenção em 24 h na NC crítica. Vencido um prazo, avisa o líder direto de quem era responsável pela etapa. O aceite continua com 2 dias úteis.
- Evidência obrigatória na validação. Feedback com resumo da conversa obrigatório, participantes opcionais por enquanto (decisão de 19/10) e posicionamento do colaborador liberado pela Qualidade quando fizer sentido (o colaborador escreve no aceite, se quiser). Medida só é aprovada com o feedback aplicado.
- Plano de ação pode ser aberto em qualquer NC validada (a crítica exige). Verificação de 30 dias só para NC com plano: "Não eficaz" e, por decisão da Qualidade, "Reaberta" ou "Escalada". A avaliação de justa causa registra o desfecho.
- A cada 3 NCs da mesma causa o colaborador fica "passível de medida" (valor interno `sugerida`). Ciclo de 12 meses por colaborador e causa, contado a partir da 1ª NC da causa; fechada a janela, tudo zera. Escada por causa no ciclo: medidas 1–3 advertência, 4–6 suspensão, 7ª em diante avaliação de justa causa; só sobem a escada as medidas aprovadas pela Qualidade (aprovadas ou aplicadas). NC com mais de uma causa conta +1 em cada causa, e cada uma pode gerar a sua medida. NC crítica fica passível de medida independentemente da contagem, em cada causa; se a contagem já gerou medida para a causa naquela NC, é uma só, com as duas origens. A Qualidade continua aprovando ou reprovando.
- Não há papel RH no sistema: o SGNC registra a situação da medida (passível, aplicada, alterada); a aplicação é feita pelo RH, presencialmente.
- Qualquer perfil abre NC; a Qualidade valida. A NC sem plano encerra no aceite. O supervisor é avisado só na validação.
- Na validação, a Qualidade informa a origem (monitoria, auditoria, supervisão, indicador, reclamação), obrigatória; procedimento e link da intranet são opcionais; e marca a NC como cobrança ou orientativa. A orientativa não conta para reincidência nem para medida. Causa individual × sistêmica não é regra: fica como observação no feedback.

Relatórios (decisões de 13/10/2026, plano em [`docs/plano-relatorios.md`](docs/plano-relatorios.md)):
- Resumo em PDF: relatório completo com o resumo de uma página como página 1; os 4 números da página 1 comparam com o período anterior de mesmo tamanho.
- Planilha: Excel com abas no botão principal; CSV mantido em versão simples.
- Nomes de colaboradores nos relatórios: Qualidade e Adm veem toda a empresa; supervisor, só a própria cadeia.
- Formatação dos relatórios passa por `src/lib/reports/formato.ts` (status com nome da tela, horário de Brasília, duração legível).

Todas as decisões do plano estão respondidas. Decisão nova que surgir deve ser perguntada ao responsável, não assumida.

## Convenções

- Uma fase por PR, validada no Preview antes do merge.
- Migrações de banco são aditivas e ficam em `supabase/migrations/`. Valor novo de enum vai numa migração separada.
- Transições de status passam por RPCs `*_vN` com histórico em `historico_nc`. Não atualize status direto pela API.
- A Qualidade nunca conduz NC em que é o colaborador analisado (`podeAtuarComoQualidade`).
- Checks: `npm run lint`, `npm run typecheck`, `npm test`.
- Credenciais de teste e token de bypass da Vercel nunca entram no repositório.
