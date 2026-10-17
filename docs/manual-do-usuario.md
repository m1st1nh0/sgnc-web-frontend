# SGNC: manual do usuário

Este manual explica como usar o SGNC (Sistema de Gestão de Não Conformidades) no dia a dia. Ele é dividido por assunto e indica, em cada parte, quem pode fazer o quê.

> Se você é da equipe técnica, veja a [documentação técnica](documentacao-tecnica.md).

## Sumário

1. [O que é o SGNC](#1-o-que-é-o-sgnc)
2. [Perfis de acesso](#2-perfis-de-acesso)
3. [Primeiro acesso](#3-primeiro-acesso)
4. [Conhecendo a tela](#4-conhecendo-a-tela)
5. [O caminho de uma NC](#5-o-caminho-de-uma-nc)
6. [Para todos: abrir uma NC](#6-para-todos-abrir-uma-nc)
7. [Para todos: acompanhar uma NC](#7-para-todos-acompanhar-uma-nc)
8. [Para o colaborador: dar o aceite](#8-para-o-colaborador-dar-o-aceite)
9. [Para a Qualidade: avaliar, dar feedback e conduzir](#9-para-a-qualidade-avaliar-dar-feedback-e-conduzir)
10. [Para a Qualidade: causas](#10-para-a-qualidade-causas)
11. [Para a Qualidade: medidas disciplinares](#11-para-a-qualidade-medidas-disciplinares)
12. [Para a liderança: acompanhar a equipe](#12-para-a-liderança-acompanhar-a-equipe)
13. [Notificações](#13-notificações)
14. [Insights e relatórios](#14-insights-e-relatórios)
15. [Pessoas, equipes e estrutura](#15-pessoas-equipes-e-estrutura)
16. [Dossiê e estatísticas](#16-dossiê-e-estatísticas)
17. [Perguntas frequentes](#17-perguntas-frequentes)
18. [Glossário](#18-glossário)

---

## 1. O que é o SGNC

Uma **não conformidade (NC)** é o registro de algo que não saiu como o procedimento pede. O SGNC organiza esse registro do começo ao fim:

1. alguém **abre** a NC sobre um colaborador;
2. a **Qualidade avalia** se ela procede;
3. a Qualidade conversa com o colaborador e **registra o feedback**;
4. o colaborador **dá o aceite**;
5. se a NC for **crítica**, segue um **plano de ação** até a verificação de eficácia.

Tudo fica registrado com data, hora e autor, e cada pessoa vê só o que lhe diz respeito.

## 2. Perfis de acesso

| Perfil | O que faz |
|---|---|
| **Colaborador** | Abre NCs, acompanha as próprias NCs e as que abriu, dá o aceite no feedback, consulta o próprio dossiê. |
| **Supervisor** | Tudo do colaborador, mais acompanhar as NCs de toda a sua equipe (liderados diretos e indiretos), ver indicadores e relatórios da equipe. |
| **Qualidade** | Avalia NCs, registra feedback, marca NCs críticas e conduz o plano de ação, mantém o catálogo de causas, decide medidas disciplinares e organiza equipes e estrutura. |
| **Administrador do sistema** | Tudo da Qualidade, mais cadastrar usuários e gerenciar acessos. |

Regra importante: **ninguém conduz a própria NC.** Se uma pessoa da Qualidade é o colaborador analisado, outra pessoa da Qualidade avalia, dá o feedback e decide qualquer medida.

## 3. Primeiro acesso

1. Entre com o e-mail e a senha provisória que o Administrador passou.
2. O sistema pede uma **senha nova**, que precisa ter:
   - 10 caracteres ou mais;
   - letra maiúscula e letra minúscula;
   - número;
   - símbolo (por exemplo `!`, `@`, `#`).
3. Uma apresentação curta explica o fluxo e o seu papel. Depois, o painel mostra o bloco **"Primeiros passos"**, com algumas tarefas para conhecer o sistema.
   - No primeiro acesso o bloco aparece aberto. Depois ele fica recolhido numa barra fina, com o botão "Continuar".
   - Para rever a apresentação a qualquer momento, use **Guia**, no rodapé do menu.

Esqueceu a senha ou a conta está bloqueada? Fale com o Administrador do sistema.

## 4. Conhecendo a tela

- **Menu lateral**, em três grupos (no celular, abra pelo ícone ☰):
  - **Operação:** o painel inicial (chamado "Gestão de NCs", "NCs da equipe" ou "Minhas NCs", conforme o perfil), Minhas NCs e Abrir NC.
  - **Análise** (Supervisor, Qualidade e Adm): Insights e Relatórios.
  - **Cadastros:** Pessoas e equipes (ou "Minha equipe"), Causas, Medidas disciplinares e Meu dossiê. Cada pessoa vê só os itens do seu perfil.
- **Sino:** mostra as notificações e quantas estão sem ler. A cor indica a mais urgente.
- **Guia:** reabre a apresentação.
- **Seu nome e perfil**, com o botão **Sair**.

No computador, a seta ao lado do logotipo recolhe ou expande o menu, e o sistema lembra a sua escolha.

### O painel inicial

O painel mostra:

- um **destaque** com o próximo passo e um botão que já filtra a lista;
- **cartões** com contagens ("Aguardando avaliação", "Aguardando aceite", "Não respondidas"…). Clicar num cartão filtra a lista abaixo;
- **atalhos** para as telas mais usadas;
- a **lista de NCs**, ordenada pelo que pede ação primeiro. A coluna **"Aguardando"** diz quem precisa agir.

## 5. O caminho de uma NC

```
Aberta → Avaliação → Feedback → Aceite → (Plano de ação, se crítica) → Concluída
```

| Status | O que significa | Quem age |
|---|---|---|
| **Aberta** | Registrada, aguardando a avaliação | Qualidade |
| **Invalidada** | A Qualidade concluiu que não procede (fim) | — |
| **Aguardando feedback** | Validada; falta a conversa com o colaborador | Qualidade |
| **Aguardando aceite** | Feedback registrado; o colaborador tem 2 dias úteis para o aceite | Colaborador analisado |
| **Não respondida** | O prazo do aceite venceu. O aceite ainda pode ser feito e fica "fora do prazo". | Colaborador analisado |
| **Em plano de ação** | NC crítica com plano em andamento | Qualidade e liderança |
| **Concluída** | Encerrada | — |

### Criticidade × NC crítica

- A **criticidade** (Baixa, Média ou Alta) é escolhida por quem abre a NC:
  - **Baixa:** baixo impacto e sem interrupção relevante da operação.
  - **Média:** impacto perceptível, retrabalho ou risco moderado.
  - **Alta:** impacto grave, interrupção ou risco elevado que exige prioridade.
- **NC crítica** é outra coisa: uma marcação que só a Qualidade faz, depois da validação, quando o caso exige um plano de ação.

### Como o prazo do aceite é contado

O colaborador tem **2 dias úteis** a partir do feedback, contados **só no expediente**: segunda a sexta, das 9h às 18h, no horário de Brasília. Feriados não são descontados.

- Feedback na segunda às 14h → prazo na quarta às 14h.
- Feedback na sexta às 15h → prazo na terça às 15h.
- Feedback no sábado, ou à noite → a contagem começa às 9h do próximo dia útil.

## 6. Para todos: abrir uma NC

Qualquer perfil pode abrir uma NC sobre qualquer colaborador ativo.

1. No menu, clique em **Abrir NC**.
2. **Quem e onde:**
   - escolha o **colaborador** (digite o nome ou o setor para localizar);
   - se houver, informe o **chamado** (número ou referência).
3. **O que aconteceu:**
   - escolha a **criticidade**;
   - escreva a **descrição** do fato;
   - selecione uma ou mais **causas** da lista.
4. **Evidências** (opcional): anexe imagens, PDF, Word ou Excel, com até 15 MB cada. Antes de enviar, você pode pré-visualizar o arquivo.
5. Confira o resumo em **"Revise antes de abrir"** e confirme.

Depois de abrir, a tela mostra a confirmação e o próximo passo ("a Qualidade avalia"). Você acompanha a NC pelo detalhe ou por **Minhas NCs**.

**Sobre as causas:** só é possível escolher causas do catálogo. Se você digitar uma causa e não escolher um item da lista, o sistema avisa no campo e não deixa enviar.

- **Não achou a causa certa?** Use **"Solicitar análise"** no campo de causas e explique o motivo. A Qualidade decide e você é avisado.
- **Você é da Qualidade?** Use o link **"Gestão de causas"**, que abre a tela de Causas em outra aba. Ao voltar para o formulário, a causa nova já aparece na lista.

**Se algo der errado:** o erro aparece junto do campo que precisa de correção, e o cursor vai até ele. Se for uma falha do servidor, o que você preencheu é mantido e aparece um código de referência. Informe esse código ao suporte.

## 7. Para todos: acompanhar uma NC

Abra a NC pela lista do painel, por **Minhas NCs** ou pelo aviso no sino. O detalhe mostra:

- **Etapas:** a trilha do fluxo, com a etapa atual destacada, **quem precisa agir** (aparece "Você" quando é com você) e, na etapa de aceite, o prazo.
- **Dados da NC:** colaborador, criticidade, causas, descrição e chamado.
- **Feedback:** causa raiz, ação combinada, responsável e prazo da ação, combinado, e a situação do aceite (aguardando, aceito no prazo, não respondida ou aceito fora do prazo).
- **Evidências:** separadas entre evidências da abertura e anexos do feedback. Clique para visualizar.
- **Histórico:** cada mudança, com data, hora e autor.
- **PDF da NC:** o documento oficial, para guardar ou imprimir.

### O que cada pessoa vê

- **Quem abriu a NC, sem ser da Qualidade nem líder do colaborador,** vê a NC de forma resumida: acompanha a etapa, mas não vê o feedback, o motivo de invalidação nem o plano de ação. No histórico, as outras pessoas aparecem pelo papel ("Qualidade", "Liderança"), não pelo nome.
- **O colaborador analisado e a sua liderança** veem a NC completa.
- **O responsável por uma ação combinada** no feedback recebe um aviso e consegue abrir a NC. Ele vê a NC resumida, com um quadro que mostra a ação sob a sua responsabilidade e o prazo dela.

### Evidências depois da abertura

Enquanto a NC está **Aberta**, quem a abriu, o colaborador analisado e a Qualidade podem anexar evidências. Quem abriu pode remover as próprias evidências nessa fase. Depois disso, só a Qualidade remove.

## 8. Para o colaborador: dar o aceite

Quando a Qualidade registra o feedback, você recebe um aviso no sino e a NC aparece em **"Aguardando meu aceite"**.

1. Abra a NC e leia o **feedback** (causa raiz, ação combinada, responsável, prazo e combinado) e os anexos.
2. No painel de aceite, digite exatamente a frase:

   ```
   li e concordo com a não conformidade e com o feedback aplicado
   ```

3. Confirme.

- O prazo aparece no painel, por exemplo: "Responda até qua, 15/10 às 14:30".
- Conforme o prazo se aproxima, o aviso sobe de nível (atenção, urgente). Seu líder também é avisado quando fica urgente.
- Se o prazo vencer, a NC fica **"Não respondida"** e você e seu líder são avisados. Você **ainda pode dar o aceite** do mesmo jeito; ele fica registrado como **"aceito fora do prazo"**.
- Se a NC for crítica, depois do aceite ela segue para o plano de ação. Você acompanha o plano, mas não altera.

Não existe, por enquanto, a opção de contestar o feedback. Em caso de discordância, converse com a Qualidade ou com sua liderança.

## 9. Para a Qualidade: avaliar, dar feedback e conduzir

O painel da Qualidade destaca o que está **aguardando avaliação** e **aguardando feedback**.

### Avaliar

Abra a NC aberta e use o painel **Avaliar Não Conformidade**:

- **Validar:** a NC procede e vai para "Aguardando feedback". O colaborador, o líder dele e quem abriu são avisados.
- **Invalidar:** informe o motivo, que é obrigatório. Quem abriu recebe só "sua NC foi reprovada", sem o motivo. O colaborador e a liderança veem o motivo no detalhe.

Na validação, o sistema conta quantas vezes a mesma causa já aconteceu com o colaborador e, se for o caso, deixa o colaborador **passível de medida** (ver seção 11).

### Editar ou excluir

- **Editar:** a Qualidade pode corrigir colaborador, criticidade, descrição, chamado e causas.
- **Excluir:** só é possível se a NC nunca foi crítica nem teve plano de ação.

### Registrar o feedback

Depois da conversa com o colaborador, preencha **todos** os campos:

| Campo | O que escrever |
|---|---|
| **Causa raiz** | Por que aconteceu |
| **Ação combinada** | O que será feito |
| **Responsável pela ação** | Quem executa, que deve ser um usuário ativo |
| **Prazo da ação** | Até quando, sem data no passado |
| **Combinado** | O acordo feito com o colaborador |

- **Anexos** são opcionais e são enviados logo depois do registro.
- Acima do formulário aparece o **histórico deste colaborador com esta causa** nos últimos 12 meses, por exemplo "3ª ocorrência em 12 meses", com as NCs anteriores clicáveis.
- Ao salvar, o colaborador passa a ter 2 dias úteis para o aceite. Ele, o líder e o responsável pela ação são avisados.

### NC crítica e plano de ação

Para casos graves, depois da validação, marque **"Marcar esta NC como crítica"**, com uma justificativa. O colaborador e toda a cadeia de liderança dele, até a Diretoria, são avisados. A NC crítica também deixa o colaborador passível de medida em cada causa.

O plano de ação tem três etapas, alimentadas pela Qualidade e pela liderança do colaborador:

1. **Planejamento:** causa raiz, ações, responsável pela execução e prazo.
2. **Execução:** o que foi feito.
3. **Acompanhamento:** registros do andamento. É preciso ao menos um.

Para concluir, a Qualidade registra a **verificação de eficácia**. Quem executou o plano não pode concluí-lo. Com o plano concluído, a NC fica **Concluída**.

## 10. Para a Qualidade: causas

Menu **Causas**. A tela tem duas partes.

- **Catálogo de causas:**
  - cadastrar uma causa nova (de 3 a 120 caracteres);
  - renomear;
  - arquivar ou reativar;
  - excluir. Uma causa com NC vinculada não pode ser excluída, só arquivada, para preservar o histórico.
- **Solicitações pendentes:** pedidos de causa feitos por outras pessoas. Você pode:
  - **aprovar**, criando a causa;
  - **apontar uma causa existente** equivalente;
  - **rejeitar**, com motivo obrigatório.

  Quem pediu é avisado da decisão.

## 11. Para a Qualidade: medidas disciplinares

### Quando o colaborador fica passível de medida

- **A cada 3 NCs da mesma causa** (3ª, 6ª, 9ª…), dentro de um **ciclo de 12 meses** que começa na 1ª NC daquela causa. Fechados os 12 meses, a contagem recomeça do zero.
- **Em toda NC crítica**, em cada causa da NC, independentemente da contagem.
- Uma NC com duas causas conta para as duas, e cada causa pode gerar a sua medida.

### Qual medida é sugerida

A sugestão segue uma escada, por causa, dentro do ciclo. Só contam as medidas já aprovadas ou aplicadas.

| Medida no ciclo | Tipo sugerido |
|---|---|
| 1ª a 3ª | Advertência |
| 4ª a 6ª | Suspensão |
| 7ª em diante | Avaliação de justa causa |

### Como decidir e registrar

O menu **Medidas disciplinares** mostra três colunas: **1 · Passíveis de medida**, **2 · Aprovadas** e **3 · Aplicadas**. As reprovadas e canceladas ficam numa seção separada.

1. **Aprovar ou reprovar** uma medida passível.
   - Ao aprovar, você pode trocar o tipo sugerido, com justificativa.
   - Reprovar exige motivo, com no mínimo 10 caracteres.
2. **Registrar a aplicação** de uma medida aprovada: data (não pode ser futura), dias de suspensão (de 1 a 30, se for suspensão) e observação.

O SGNC **registra a situação** da medida. A aplicação em si é feita pelo RH, presencialmente.

Quem é avisado:

- o colaborador e o líder dele, só quando a medida é **aplicada**;
- a Qualidade, a cada etapa.

Ninguém decide nem aplica medida sobre si mesmo.

## 12. Para a liderança: acompanhar a equipe

O supervisor vê as NCs de **toda a sua cadeia de liderados**, diretos e indiretos.

- **Painel "NCs da equipe":** cartões por etapa, com destaque para os aceites pendentes e as "Não respondidas".
- **Minha equipe:** lista dos liderados. Abra uma pessoa para ver as NCs e o histórico dela.
- **Insights e Relatórios:** os mesmos indicadores da Qualidade, limitados à sua equipe.
- **Plano de ação:** nas NCs críticas da sua equipe, você ajuda a preencher o planejamento, a execução e o acompanhamento.

Avisos que o líder recebe:

- **NC validada** contra alguém da equipe;
- **feedback registrado**, com o prazo do aceite;
- **lembretes urgentes** e **"Não respondida"**;
- **medida aplicada**.

Em **NC crítica**, todos os líderes da cadeia, até a Diretoria, recebem os avisos da marcação e do plano.

## 13. Notificações

O **sino** no menu reúne os avisos que dizem respeito a você. Ele é atualizado ao abrir a página, ao voltar para a aba e a cada minuto.

- Clique num aviso para ir à NC (ou à medida ou causa). O aviso é marcado como lido.
- Use **"Marcar todas como lidas"** para limpar o contador.
- Avisos de pendência, como "precisa do seu aceite", somem sozinhos quando a pendência é resolvida.
- Os níveis são **normal → atenção → urgente → crítica**. Um lembrete atualiza o mesmo aviso, em vez de empilhar outro.
- Lembretes só acontecem no expediente (segunda a sexta, das 9h às 18h).
- Você nunca é avisado de algo que você mesmo fez.

Os avisos ficam só dentro do aplicativo, sem envio por e-mail.

## 14. Insights e relatórios

Disponíveis para Supervisor (sua equipe), Qualidade e Adm (toda a empresa).

### Insights

Painel com indicadores do período escolhido:

- **O que os dados indicam:** leitura resumida.
- **Operação agora:** NCs em aberto por etapa e há quanto tempo estão paradas.
- **Movimento no período:** evolução mensal.
- **Velocidade do fluxo:** tempo entre as etapas.
- **Causas e reincidência:** principais causas, reincidência por causa e por colaborador, NCs por criticidade.
- **Distribuição organizacional:** NCs por colaborador e por setor.
- **Disciplina:** passíveis de medida por causa.

Clique num número ou numa barra para ver a lista das NCs por trás dele.

### Relatórios

Escolha o período (há atalhos) e os filtros. A tela tem as abas **Visão geral**, **Por setor**, **Por colaborador** e **Prazos e aceites**. Para baixar:

| Botão | O que gera |
|---|---|
| **Baixar Excel** | Planilha com as abas NCs, Causas, Feedback, Linha do tempo, Indicadores e Leia-me |
| **Baixar PDF** | Relatório gerencial. A 1ª página resume o período e compara 4 números com o período anterior de mesmo tamanho; as páginas seguintes detalham fluxo, prazos, causas, setores, pessoas, medidas e a lista de NCs |
| **CSV simples** | Uma linha por NC, 15 colunas, para abrir em qualquer programa |

Todos os PDFs trazem no rodapé quem gerou, quando, e o número da página. As datas aparecem no horário de Brasília.

## 15. Pessoas, equipes e estrutura

Menu **Pessoas e equipes** (Qualidade e Adm) ou **Minha equipe** (Supervisor).

| Aba | Quem | Para quê |
|---|---|---|
| **Equipes** | Qualidade, Adm, Supervisor | Árvore de lideranças a partir da Diretoria. A Qualidade e o Adm usam o menu **Ações** para trocar a liderança, alternar o perfil Supervisor ↔ Colaborador e alterar departamento e cargo. O alerta "Sem liderança ativa" mostra quem precisa de líder. |
| **Lista** | Qualidade, Adm, Supervisor | Busca por pessoa, setor ou liderança; opção de incluir inativos. |
| **Estrutura** | Qualidade, Adm | Departamentos (com área-mãe e responsável) e cargos. Desativar mantém o histórico; nada é apagado. |
| **Acessos** | Adm | Cadastrar usuário (nome, e-mail, perfil, departamento, cargo, liderança e senha inicial), editar, desativar e reativar, e marcar "Membro da Diretoria". |

Regras:

- **Todo mundo tem um líder**, exceto os membros da Diretoria, que ficam no topo.
- Ao escolher o departamento, o sistema sugere como líder o responsável do departamento, mas você pode escolher outra pessoa.
- A troca de líder é feita **só pela aba Equipes**, e fica registrada no histórico da pessoa.
- Um usuário novo entra com senha provisória e troca a senha no primeiro acesso.

## 16. Dossiê e estatísticas

- **Meu dossiê** (todos): histórico consolidado das suas NCs e medidas, com download em PDF. Supervisores, Qualidade e Adm abrem o dossiê das pessoas que podem ver.
- **Estatísticas** da pessoa: causas contabilizadas, ocorrências por causa e recorrência no ciclo.

## 17. Perguntas frequentes

**Abri uma NC e não vejo o feedback. Por quê?**
Quem só abriu a NC acompanha a etapa, mas não vê o feedback, que é uma conversa entre a Qualidade, o colaborador e a liderança. Você recebe aviso quando a NC é aprovada ou reprovada.

**Digitei uma causa e não consigo enviar.**
Escolha um item da lista ou apague o texto. Se a causa não existe, use "Solicitar análise".

**Perdi o prazo do aceite. E agora?**
Ainda dá para aceitar, com a mesma frase. O aceite fica marcado como "fora do prazo", e a NC continua contando como ocorrência.

**O prazo do aceite conta no fim de semana?**
Não. Só de segunda a sexta, das 9h às 18h.

**Sou da Qualidade e a NC é sobre mim. Posso avaliar?**
Não. Outra pessoa da Qualidade conduz. Você recebe os avisos como colaborador.

**Recebi um aviso de "responsável pela ação" numa NC que não é minha.**
O feedback combinou uma ação sob a sua responsabilidade. Abra pelo aviso para ver o que é e o prazo.

**Apareceu uma mensagem com um código de referência.**
Foi uma falha do servidor. O que você preencheu foi mantido. Tente de novo e, se persistir, envie o código ao suporte.

**Quero rever a apresentação inicial.**
Clique em **Guia**, no rodapé do menu.

## 18. Glossário

| Termo | Significado |
|---|---|
| **NC** | Não conformidade |
| **Colaborador analisado** | Pessoa sobre quem a NC foi aberta |
| **Criticidade** | Gravidade informada na abertura: Baixa, Média ou Alta |
| **NC crítica** | Marcação da Qualidade, após a validação, que gera plano de ação e medida |
| **Feedback** | Registro da conversa da Qualidade com o colaborador (causa raiz, ação, responsável, prazo e combinado) |
| **Aceite** | Confirmação formal do colaborador, digitando a frase, de que leu e concorda com a NC e o feedback |
| **Não respondida** | NC cujo prazo de aceite venceu sem resposta |
| **Reincidência / ocorrência** | Repetição da mesma causa com o mesmo colaborador |
| **Passível de medida** | Situação em que a contagem ou a NC crítica indica uma medida disciplinar, que a Qualidade aprova ou reprova |
| **Ciclo** | Janela de 12 meses por colaborador e causa, a partir da 1ª NC daquela causa |
| **Plano de ação** | Planejamento, execução, acompanhamento e verificação de eficácia de uma NC crítica |
| **Liderança / cadeia** | O líder direto e, acima dele, os líderes até a Diretoria |
| **Expediente** | Segunda a sexta, das 9h às 18h, no horário de Brasília |
