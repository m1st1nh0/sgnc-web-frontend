# Roteiro de UAT: retorno da diretoria de 29/09/2026

Fase 6 do plano [`plano-retorno-diretoria-2909.md`](plano-retorno-diretoria-2909.md). Este roteiro cobre os 9 pontos da diretoria e as notificações. Use três contas:

- **Qualidade:** papel Qualidade ou Adm.
- **Supervisor:** líder do colaborador analisado.
- **Colaborador:** na interface o papel aparece como "Colaborador"; no banco o valor é `funcionario`.

Faça cada bloco no computador e no celular (ou na largura de celular do navegador).

> O Preview e a produção usam o **mesmo banco**. Marque todas as NCs de teste com "TESTE-UAT" na descrição. Ao final, peça a remoção dessas NCs.

Preencha a coluna "OK?" com ✅, ❌ (anote o que viu) ou "n/a".

## 1. Lentidão (ponto 1)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| 1.1 | Qualidade | Abrir o painel, abrir uma NC e voltar. | As telas carregam sem a espera longa de antes. | |
| 1.2 | Quem tem acesso ao Preview | Rodar `scripts/medir-rotas.mjs` (instruções no próprio arquivo) e enviar o resultado. | p50/p95 de `/api/nc`, `/api/nc/[id]` e `/api/nc/[id]/evidencias`; o `x-vercel-id` mostra `gru1`. | |

## 2. Causa só do catálogo (ponto 2)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| 2.1 | Qualidade | Abrir uma NC e digitar uma causa que não existe. | Não há opção de criar; aparece o link "Cadastrar no catálogo", que abre `/causas`. | |
| 2.2 | Colaborador | Abrir uma NC e digitar uma causa que não existe. | Só "Solicitar análise"; a causa não é criada. | |
| 2.3 | Qualidade | Editar uma NC aberta e tentar incluir causa fora do catálogo. | Bloqueado, com aviso no campo Causas. | |

## 3. Status depois de abrir a NC (ponto 3)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| 3.1 | Colaborador | Abrir uma NC contra um colega. | Confirmação "NC registrada. Próximo passo: a Qualidade avalia" e link para Minhas NCs. | |
| 3.2 | Colaborador | Abrir a NC registrada. | Etapas do fluxo com a etapa atual destacada e quem deve agir. | |
| 3.3 | Qualidade | Validar a NC e abrir o histórico. | Linha do tempo com autor e data de cada transição. | |
| 3.4 | Supervisor | Ver o painel e Minhas NCs. | Coluna "Aguardando" mostra quem deve agir ("Você" quando é a própria pessoa). | |

## 4. Erro ao salvar (ponto 4)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| 4.1 | Qualidade | Abrir NC sem colaborador e sem descrição. | Erro em cada campo, com foco e rolagem até o primeiro. | |
| 4.2 | Qualidade | Digitar uma causa e enviar sem escolher da lista. | Envio bloqueado: "Selecione uma causa da lista ou apague o texto digitado". | |
| 4.3 | Qualidade | Registrar feedback deixando um campo obrigatório vazio. | O erro aponta o campo que falta. | |

## 5 a 8. Navegação (pontos 5, 6, 7 e 8)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| 5.1 | Qualquer | Em "Primeiros passos", abrir o item de localizar uma NC. | Leva à lista de NCs. | |
| 6.1 | Qualquer | Entrar de novo depois do primeiro acesso. | "Primeiros passos" aparece recolhido. | |
| 7.1 | Qualidade | Clicar no botão de próxima ação do painel. | Aplica o filtro correspondente na lista, sem só rolar a página. | |
| 8.1 | Qualidade | Clicar nos cards de status do painel. | A lista é filtrada; clicar de novo ou em "Limpar" volta ao normal. | |

## 9. Controle do feedback (ponto 9)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| 9.1 | Qualidade | Registrar o feedback de uma NC validada. | Campos obrigatórios: causa raiz, ação combinada, responsável pela ação, prazo da ação e combinado. O anexo é opcional. | |
| 9.2 | Qualidade | Ver o bloco de reincidência no feedback. | NCs anteriores do mesmo colaborador com a mesma causa nos últimos 12 meses. | |
| 9.3 | Colaborador | Abrir a NC com feedback. | Prazo do aceite (2 dias úteis em horas de expediente); o aceite exige digitar a frase. | |
| 9.4 | Colaborador | Esperar o prazo vencer, ou pedir a simulação. | Status "Não respondida", com histórico. O aceite tardio fica marcado "aceito fora do prazo". | |
| 9.5 | Qualidade | Validar a 4ª ocorrência da mesma causa. | Medida sugerida em `/medidas`, que segue as etapas sugerida → aprovada/reprovada → aplicada. Quem é colaborador da NC não decide nem aplica. | |

## Notificações (critério 7a)

| # | Perfil | Passo | Esperado | OK? |
|---|---|---|---|---|
| N.1 | Colaborador | Abrir uma NC. | Sino da Qualidade acende ("Nova NC para avaliar"); o de quem abriu, não. | |
| N.2 | Qualidade | Reprovar uma NC. | Quem abriu recebe "foi reprovada", sem o motivo. | |
| N.3 | Qualidade | Validar uma NC. | O acusado, o líder direto e quem abriu ("aprovada") são avisados; os avisos "avaliar" dos demais saem das pendências. | |
| N.4 | Qualidade | Registrar o feedback com um terceiro colaborador como responsável pela ação. | Acusado e líder recebem o aviso do aceite. O responsável recebe "Você é responsável por uma ação" e, pelo link, vê o quadro da ação. | |
| N.5 | Colaborador | Registrar o aceite. | As pendências de aceite são resolvidas. | |
| N.6 | Qualidade | Marcar uma NC como crítica. | O acusado e a cadeia até a Diretoria são avisados; quem marcou, não. | |
| N.7 | Qualquer | Ver o sino com o menu aberto, recolhido e no celular. | Ícone alinhado aos outros itens, contador visível e painel abrindo ao lado do menu (no celular, abaixo da barra). | |

## Resultado

| Perfil | Computador | Celular | Observações |
|---|---|---|---|
| Qualidade | | | |
| Supervisor | | | |
| Colaborador | | | |
