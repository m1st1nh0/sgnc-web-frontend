# Plano: estrutura organizacional (lideranças e departamentos)

Objetivo: representar a empresa como ela é. A Diretoria fica no topo, cada liderança enxerga toda a cadeia abaixo dela e as pessoas ficam organizadas por departamento.

## Diagnóstico (11/10/2026)

- A árvore por `usuarios.supervisor_id` já tem vários níveis, e uma liderança enxerga toda a cadeia abaixo (`listarPessoasAbaixo`).
- O perfil mistura **permissão** (o que a pessoa faz no sistema) e **posição** (onde ela fica no organograma):
  - Qualidade e Administrador não podem ter liderança. A RPC `alterar_equipe_v1` recusa com `papel_fora_das_equipes`, e `editarUsuario` zera o supervisor.
  - A cadeia só se propaga por quem tem perfil Supervisor (`listarPessoasAbaixo`, `nc_lidera_colaborador`). Liderados de alguém da Qualidade ficam invisíveis para quem está acima.
  - `listarPessoasGerenciaveis` deixa Qualidade e Adm fora da lista de pessoas, então eles não podem ser movidos na árvore.
- O setor é texto livre (`usuarios.setor`). Não existe cadastro de departamento nem responsável por área.

## Decisões do responsável (11/10/2026)

| # | Pergunta | Decisão |
|---|---|---|
| E1 | Qualidade e Adm passam a ter liderança? | **Sim.** Eles entram na árvore como qualquer pessoa (ex.: Keila responde ao Cristiano). |
| E2 | Perfil do diretor | **Supervisor no topo.** Vê toda a empresa pela hierarquia e não conduz NCs como Qualidade. |
| E3 | Raiz única? | **Não.** Pode haver mais de uma pessoa no topo (membros da Diretoria). |
| E4 | Avisos ao diretor | Só **NC crítica** (marcada como crítica, que gera plano de ação) sobe pela cadeia até o topo. É a regra D17/R7 do plano da diretoria, que agora passa também por Qualidade e Adm. |
| E5 | Departamentos | **Sim**, como cadastro, com a estrutura abaixo. |
| E12 | Expansão | A empresa está crescendo: **departamentos, cargos e lideranças são criados e alterados pela própria tela**, sem depender de migração ou de desenvolvedor. |

Estrutura informada:

```
Diretoria: Cristiano (CEO)
├── Suporte: Supervisor do suporte → colaboradores do suporte
├── Produção: Supervisor da Produção (também sócio) → desenvolvedores
├── Inteligência: Keila (supervisora)
│   ├── Sucesso do cliente
│   ├── Qualidade
│   ├── Implantação
│   └── Treinamento
└── RH/Financeiro: Carla (única do setor, tratada como Diretoria)
```

### Decisões de 11/10/2026 (segunda rodada)

| # | Pergunta | Decisão |
|---|---|---|
| E6 | Carla | No topo, como membro da Diretoria, com perfil Supervisor. |
| E7 | Quem pode ficar sem liderança? | **Só a Diretoria.** Supervisores, Qualidade e Adm têm liderança, podem ser apontados em NCs, e os líderes deles ficam sabendo. |
| E8 | Sub-áreas da Inteligência | Departamentos com pai: Sucesso do cliente, Qualidade, Implantação e Treinamento como filhos de Inteligência. |
| E9 | Departamento × liderança | Cada pessoa tem um departamento e uma liderança. A liderança **sugerida** é o responsável do departamento, mas pode ser outra. |
| E10 | Setor (texto) | O departamento substitui o setor. Os setores atuais são convertidos na migração. |
| E11 | Cristiano deixa de ser Qualidade | **Confirmado.** Como Supervisor (E2), ele não valida NC nem cuida de causas e medidas. |
| E13 | Cargo × perfil | O cargo descreve a função e é cadastrado livremente; o perfil é a permissão. Um cargo "de liderança" sugere o perfil Supervisor, sem trocá-lo sozinho. |
| E14 | Quem mantém a estrutura | Qualidade e Administrador. Marcar quem é da Diretoria fica na aba Acessos (Administrador). |

Decisão técnica: "Diretoria" é uma **marca na pessoa** (`usuarios.diretoria`), e não um departamento. Carla é de RH/Financeiro e o sócio é da Produção, mas os dois são da Diretoria.

## Fases

### Fase A: hierarquia única (E1, E2, E3, E6, E7, E11)
Migração `20261011120000_estrutura_diretoria.sql` (aditiva) e o app.

- [x] A.1 Coluna `usuarios.diretoria` e RPC `alterar_equipe_v2`: move qualquer pessoa, inclusive Qualidade e Adm (sem `papel_fora_das_equipes`). Recusa mover a Diretoria (`diretoria_no_topo`) e mantém a proteção contra ciclo. A troca de perfil continua limitada a Supervisor ↔ Colaborador.
- [x] A.2 `nc_lidera_colaborador` (helper, mesma assinatura): a cadeia sobe por qualquer pessoa, inclusive a partir de Qualidade e Adm. Quem consulta continua tendo de ser um supervisor ativo.
- [x] A.3 `listarPessoasAbaixo` e `mapearProfundidadeLiderados` propagam por qualquer pessoa com liderados. `listarPessoasGerenciaveis` inclui Qualidade e Adm.
- [x] A.4 Cadastro e "Editar" (aba Acessos): opção "Membro da Diretoria". Quem é da Diretoria fica sem liderança; todos os demais precisam de uma.
- [x] A.5 Aba Equipes: a Diretoria é o topo da árvore. Qualidade e Adm aparecem com o menu Ações. O alerta "Sem liderança ativa" vale para quem não é da Diretoria.
- [x] A.6 Testes unitários (cadeia por Qualidade, Diretoria) e RPC exercitada num Postgres local: Qualidade com liderança, ciclo recusado, Diretoria não é movida, perfil de Qualidade não alterna, CEO lidera colaborador e Qualidade abaixo dele.
- [x] A.7 Migração aplicada no Supabase em 11/10, com autorização do responsável. Conferido: coluna `diretoria` criada (nenhum membro marcado ainda), `alterar_equipe_v2` executável só pelo service role, nova `nc_lidera_colaborador` ativa, sem alertas novos de segurança.
- [ ] A.7b Validar no Preview com dados reais: marcar a Diretoria, posicionar Qualidade e Adm, mover pessoas.
- [x] A.9 A função `lideranca_de` da migração de notificações (aplicada no banco em 10/10, mas ainda fora do `main`) sobe a cadeia só por supervisores e só devolve supervisores. Com a Fase A, uma NC crítica de alguém abaixo da Keila não chegaria ao Cristiano. Ajustar no PR das notificações para subir por qualquer pessoa (E4/E7). **Feito (11/10)** na migração `20261011140000_notificacoes_cadeia_lideranca.sql`, no PR da Fase 5.
- [ ] A.8 A política legada `private.e_meu_subordinado` (RLS de defesa em profundidade) ainda só considera liderados diretos. O app usa o service role, então nada muda para o usuário; revisar quando a RLS for atualizada.

### Fase B: departamentos e cargos (E5, E8, E9, E10, E12, E13)
- [x] B.1 Migração `20261011130000_departamentos_cargos.sql`: tabelas `departamentos` (nome, `departamento_pai_id`, `responsavel_id`, ativo) e `cargos` (nome, `departamento_id` opcional, `lideranca` sim/não, ativo); `usuarios.departamento_id` e `usuarios.cargo_id`. Conversão dos setores atuais (sem diferenciar maiúsculas e espaços); o setor passa a espelhar o nome do departamento. Testada num Postgres local.
- [x] B.2 Aba "Estrutura" em Pessoas e equipes (Qualidade e Adm): criar, editar e desativar departamentos (com área-mãe e responsável) e cargos. Nada é apagado: desativar mantém o histórico.
- [x] B.3 Pessoa: departamento e cargo no cadastro (aba Acessos) e em "Alterar departamento e cargo" (aba Equipes), com histórico. A liderança sugerida é o responsável do departamento. No "Editar" de Acessos, departamento e cargo ficam só para leitura, como a liderança.
- [x] B.3b Migração aplicada no Supabase em 11/10, com autorização do responsável. Os 7 setores viraram departamentos (Diretoria, Inteligência, Produção, Qualidade, Suporte, Teste, Treinamento) e as 9 pessoas ficaram com departamento. As tabelas novas só são acessíveis pelo service role, sem alertas novos de segurança.
- [ ] B.3c Validar no Preview e cadastrar a estrutura real: Qualidade e Treinamento (e Sucesso do cliente e Implantação) como sub-áreas da Inteligência, responsáveis e cargos.
- [ ] B.4 Trocar o responsável de um departamento oferece mover junto os liderados dele, com confirmação e histórico.
- [ ] B.5 Filtro por departamento nos Insights/Relatórios no lugar do setor. (Na árvore da aba Equipes já está feito, incluindo as sub-áreas.)

### Fase C: cadastro da estrutura real
- [ ] C.1 O Administrador cadastra os membros da Diretoria, os supervisores e os departamentos, e move as pessoas na aba Equipes.
- [ ] C.2 Conferir no Preview: Cristiano vê a empresa toda; Keila vê só a Inteligência; uma NC crítica de alguém da Inteligência chega à Keila e ao Cristiano.

As notificações da Fase 5 do plano da diretoria passam a usar essa cadeia quando forem implementadas.
