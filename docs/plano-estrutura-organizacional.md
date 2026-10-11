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

## Decisões em aberto

| # | Pergunta | Proposta |
|---|---|---|
| E6 | Carla: perfil e posição | Topo (Diretoria) com perfil Supervisor, sem liderados. Alternativa: Colaboradora abaixo do Cristiano. Uma Colaboradora no topo não teria quem desse o feedback das NCs dela. |
| E7 | Quem pode ficar no topo (sem liderança)? | Supervisor, Qualidade e Adm. **Colaborador sempre tem liderança.** Colaborador sem liderança continua no alerta "Sem liderança ativa". |
| E8 | Sub-áreas da Inteligência | Departamentos com pai: Sucesso do cliente, Qualidade, Implantação e Treinamento como filhos de Inteligência. |
| E9 | Departamento × liderança | Cada pessoa tem um departamento e uma liderança. Ao escolher o departamento, a liderança **sugerida** é o responsável dele, mas pode ser outra (ex.: sócio da Produção sem liderança). |
| E10 | Setor (texto) | O departamento substitui o setor. Os textos atuais são convertidos em departamentos na migração, e o campo antigo fica só para leitura até ser removido. |
| E13 | Cargo × perfil | O **cargo** (CEO, Supervisor do suporte, Desenvolvedor...) é cadastrado livremente e descreve a função. O **perfil** continua sendo a permissão no sistema. Um cargo pode ser marcado como "de liderança", e aí sugere o perfil Supervisor, sem trocá-lo sozinho. |
| E11 | Cristiano deixa de ser Qualidade | Ao virar Supervisor (E2), ele perde validar/invalidar NC, causas e medidas. Confirmar. |

## Fases

### Fase A: hierarquia única (E1, E2, E3, E7)
Uma migração aditiva e o app.

- [ ] A.1 RPC `alterar_equipe_v2`: aceita mover Qualidade e Adm (sem `papel_fora_das_equipes`), mantém a proteção contra ciclo e a regra "Colaborador sempre tem liderança". A troca de perfil continua limitada a Supervisor ↔ Colaborador.
- [ ] A.2 `nc_lidera_colaborador_v2` e chamadas: a cadeia sobe por qualquer pessoa com liderados, inclusive Qualidade e Adm.
- [ ] A.3 `listarPessoasAbaixo` propaga por qualquer pessoa com liderados. `listarPessoasGerenciaveis` passa a incluir Qualidade e Adm.
- [ ] A.4 `editarUsuario` e o cadastro: liderança opcional para Supervisor, Qualidade e Adm (podem ficar no topo) e obrigatória para Colaborador.
- [ ] A.5 Aba Equipes: o topo são as pessoas sem liderança (Diretoria). Qualidade e Adm aparecem na árvore com o menu Ações. O alerta fica só para Colaborador sem liderança.
- [ ] A.6 Testes: ciclo, Qualidade com liderança, cadeia de NC crítica passando por Qualidade, Colaborador sem liderança recusado.

### Fase B: departamentos e cargos (E5, E8, E9, E10, E12, E13)
- [ ] B.1 Migração: tabelas `departamentos` (nome, `departamento_pai_id`, `responsavel_id`, ativo) e `cargos` (nome, `departamento_id` opcional, `lideranca` sim/não, ativo); `usuarios.departamento_id` e `usuarios.cargo_id`. Conversão dos setores atuais.
- [ ] B.2 Aba "Estrutura" em Pessoas e equipes (Qualidade e Adm): criar, editar e desativar departamentos (com área-mãe e responsável) e cargos. Nada é apagado: desativar mantém o histórico.
- [ ] B.3 Pessoa: escolher departamento e cargo no cadastro e na aba Equipes. A liderança sugerida é o responsável do departamento.
- [ ] B.4 Trocar o responsável de um departamento oferece mover junto os liderados dele, com confirmação e histórico.
- [ ] B.5 Filtro por departamento na árvore e nos Insights/Relatórios no lugar do setor.

### Fase C: cadastro da estrutura real
- [ ] C.1 O Administrador cadastra os membros da Diretoria, os supervisores e os departamentos, e move as pessoas na aba Equipes.
- [ ] C.2 Conferir no Preview: Cristiano vê a empresa toda; Keila vê só a Inteligência; uma NC crítica de alguém da Inteligência chega à Keila e ao Cristiano.

As notificações da Fase 5 do plano da diretoria passam a usar essa cadeia quando forem implementadas.
