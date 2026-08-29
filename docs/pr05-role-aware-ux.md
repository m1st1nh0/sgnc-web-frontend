# PR05 — UX por papel

## Objetivo

Adaptar a experiência ao papel autenticado sem duplicar autorização do backend e sem antecipar o redesign dos Insights do PR06.

## Matriz de experiência

| Papel | Home | Insights | Usuários | Editar NC | Ação principal |
| --- | --- | --- | --- | --- | --- |
| ADM | Gestão de NCs | Sim | Sim | Somente NC aberta | Avaliar e aplicar feedback |
| Supervisor | Acompanhamento da equipe direta | Sim, equipe direta | Não | Não | Acompanhar equipe |
| Funcionário | Minhas NCs e registros abertos por mim | Não | Não | Não | Aceitar feedback / acompanhar |

O frontend esconde e redireciona rotas incompatíveis com o papel. O backend e o RLS continuam sendo a autoridade final.

## Home

- ADM prioriza `aberta` e `aguardando_feedback`.
- Supervisor calcula métricas somente com os IDs retornados pela listagem administrativa escopada a subordinados diretos.
- Funcionário destaca NCs relacionadas a ele, aceite pendente e registros que ele próprio abriu.
- O nome de quem abriu a NC usa `/usuarios/opcoes-nc`, diretório mínimo global já autorizado para o seletor de abertura de NC. A Home deixa de depender de `/usuarios`, cujo conteúdo é propositalmente limitado por papel.

## Evidências

- O upload é aguardado antes de atualizar a lista.
- Em falha, o arquivo selecionado permanece disponível e a ação muda para `Tentar novamente`; não há retry automático de POST para evitar duplicidade caso a resposta se perca após o servidor receber o arquivo.
- Enquanto o upload está em andamento, avaliar, invalidar, editar e excluir a NC ficam indisponíveis.
- O backend continua responsável por validar autorização, status da NC e segurança do arquivo.

## Fora do escopo

- Redesign dos gráficos/KPIs de Insights (PR06).
- Novos relatórios (PR07).
- Hardening de MIME/magic bytes/limites de Storage (PR08).
- Pipeline DevSecOps abrangente (PR09).
