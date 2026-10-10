# Prompt de execução: retorno da diretoria até o goal

Copie o bloco abaixo inteiro numa nova sessão do Claude Code neste repositório. Credenciais de teste e o token de bypass da Vercel **não** estão aqui: envie-os na própria sessão, quando o agente pedir.

---

```
Você vai executar, do começo ao fim, o plano de correções do SGNC até cumprir o goal do ciclo. Trabalhe em português (código, textos de interface, commits, PRs e mensagens para mim).

## Fontes de verdade (leia antes de qualquer coisa)
1. `CLAUDE.md`: decisões que valem como regra e convenções do projeto.
2. `docs/plano-retorno-diretoria-2909.md`: goal, critérios de conclusão, decisões D1–D22, fases 0 a 6 com checklist por arquivo, matriz de notificações (regras R1–R7) e a seção "Devolutiva".
Se algo aqui conflitar com esses arquivos, os arquivos vencem. Se surgir uma decisão de produto que eles não respondem, PARE e me pergunte; nunca assuma uma recomendação como aprovada.

## Goal
Fechar os 9 pontos levantados pela diretoria em 29/09/2026. O ciclo só termina quando todos os critérios de conclusão da seção "Goal" do plano forem verdadeiros e a seção "Devolutiva" estiver preenchida.

## Estado atual
- Fase 0: região confirmada (`iad1`, banco em `sa-east-1`); medição de tempo pendente porque o ambiente não alcançava `*.vercel.app`.
- Fase 1: implementada no PR "fase 1 do retorno da diretoria"; confira no GitHub se já foi validada e incorporada ao `main` antes de seguir.
- Fases 2, 3, 4, 4B, 5 e 6: não iniciadas.

## Ordem de execução
0 (completar medição) → 1 (se ainda não incorporada) → 2 → 3 → 4 → 4B → 5 → 6. As fases 1 e 2 são independentes; as demais seguem em ordem, porque cada uma usa o que a anterior criou (a 5 depende dos eventos da 4 e da 4B).

## Ciclo de cada fase
1. Releia a seção da fase no plano e o código que ela toca. Liste para mim, em poucas linhas, o que vai fazer e qualquer dúvida de produto que encontrar.
2. Parta do `main` atualizado. Uma fase por branch e por PR (PR em rascunho).
3. Implemente seguindo o checklist da fase, sem ampliar o escopo. Melhorias fora da fase vão para o plano como sugestão, não para o PR.
4. Banco de dados:
   - Migrações aditivas em `supabase/migrations/`, com nome datado; valor novo de enum em migração separada.
   - Transições de status sempre por RPC `*_vN` com registro em `historico_nc`; nunca atualize status direto pela API.
   - ATENÇÃO: o Preview e a produção usam o MESMO projeto Supabase (`bxnuslxrlmqzytryxzvv`). Antes de aplicar qualquer migração, mostre-me o SQL e espere meu "pode aplicar". Testes no banco usam dados temporários marcados e removidos ao final; nunca altere ou apague dados reais.
5. Regras de negócio que não podem ser quebradas: a Qualidade nunca conduz NC em que é o colaborador analisado (`podeAtuarComoQualidade`), e o mesmo vale para medida disciplinar; acesso por hierarquia validado no servidor; causas só pelo catálogo.
6. Testes: escreva testes unitários para as regras novas (em `tests/*.unit.spec.ts`, no padrão existente) e rode, sem exceção, antes de cada push:
   `npm run lint && npm run typecheck && npm run build && npm test && npm run test:api`
   (o build precisa de NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; use valores de teste como no `playwright.config.ts`). Nunca desative, pule ou enfraqueça um teste para ficar verde.
7. Revise o próprio diff procurando o que quebraria em produção antes de enviar.
8. Abra o PR com: o que muda (por ponto da diretoria e decisão D#), como validar no Preview (passo a passo por perfil: Qualidade, supervisor, colaborador), testes rodados e o que não foi possível testar.
9. Marque os checkboxes da fase no plano e registre resultados (medições, divergências encontradas) no mesmo PR.
10. Acompanhe o PR até ficar verde e sem conflito. Depois PARE e me peça a validação no Preview. Só faça o merge depois do meu "aprovado" para aquela fase; então siga para a próxima.

## Particularidades por fase
- Fase 0/2: meça p50/p95 (10 chamadas) de GET /api/nc, GET /api/nc/[id], GET /api/nc/[id]/evidencias antes e depois da Fase 2, logado como Qualidade, usando o token de bypass no cabeçalho `x-vercel-protection-bypass`. Não crie NCs na base para medir POST. Se `*.vercel.app` continuar bloqueado pela rede do ambiente, me avise e siga sem a medição, deixando o script pronto. A região `gru1` vai em `vercel.json`.
- Fase 3: use a rota de timeline que já existe; os nomes dos autores dos eventos respeitam o acesso restrito de quem não é Qualidade.
- Fase 4: prazo de aceite = 18 horas de expediente (seg–sex, 9h–18h, fuso America/Sao_Paulo, sem feriados); use os exemplos do plano como casos de teste. Status `nao_respondida` com aceite tardio marcado como "fora do prazo"; conta como ocorrência para reincidência. O backfill não inventa causa raiz.
- Fase 4B: medida em etapas (sugerida → aprovada/reprovada → aplicada), regra D19 também no banco (CHECK), índice único contra duplicidade, botão escondido para a própria pessoa.
- Fase 5: implemente a matriz e as regras R1–R7 numa função central chamada dentro das RPCs (mesma transação). Teste cada evento × papel, incluindo: Qualidade acusada, supervisor que abre NC contra a própria equipe, NC crítica com cadeia de liderança, lembretes em horas de expediente. Agendamento por `pg_cron` (peça minha confirmação antes de instalar a extensão).
- Fase 6: roteiro de UAT por perfil cobrindo os 9 pontos e as notificações; atualize `docs/backlog-melhorias-operacionais.md`; preencha a "Devolutiva" em linguagem de negócio, ponto a ponto, com onde ver cada mudança.

## Segurança
- Credenciais de teste e o token de bypass ficam só no diretório temporário da sessão, com permissão restrita; nunca em commit, PR, log ou comentário.
- Não altere configurações de projeto na Vercel ou no Supabase além do que a fase pede, e sempre com meu ok.

## Quando parar e falar comigo
- Decisão de produto não coberta pelo plano.
- Antes de aplicar migração ou instalar extensão no Supabase.
- PR verde aguardando validação no Preview.
- Bloqueio que você não consegue resolver (rede, permissão, teste que falha por motivo externo): diga exatamente o que bloqueia e o que precisa.

Ao concluir cada fase, me dê um resumo curto: o que mudou para o usuário, link do PR, testes, e o que falta para o goal.
```
