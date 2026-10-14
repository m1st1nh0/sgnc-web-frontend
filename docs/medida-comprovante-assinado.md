# Comprovante assinado na aplicação da medida

Decisão de 14/10/2026: a aplicação pelo RH ocorre fora do SGNC. No formulário **Registrar aplicação**, data e foto assinada são obrigatórias; observação permanece opcional. Aprovação e sugestão não mudam.

## Entrega

- Uma foto JPG, PNG ou WebP de até 4 MiB, com seleção confirmada, remoção e substituição antes do registro.
- Validação no cliente, API e banco. MIME e cabeçalho binário são conferidos no servidor; legibilidade e assinatura são conferidas por quem registra.
- Arquivo no bucket privado `medidas-assinadas`. A API mantém acesso restrito à Qualidade/Adm, como a tela atual; nunca permite aplicar a própria medida.
- Upload precede a RPC `aplicar_medida_com_comprovante_v2`, que trava a medida e grava aplicação + caminho/nome numa transação. Upload malsucedido não altera a medida.
- Erro de confirmação com resultado ambíguo preserva o arquivo para não apagar comprovante já registrado. Arquivos órfãos de falhas de rede podem exigir conciliação administrativa; não há exclusão automática nesses casos.
- Links de visualizar/baixar verificam sessão e perfil a cada clique e emitem URL com 60 segundos de validade, sem cache da resposta.
- Medidas antigas continuam consultáveis sem anexo. Não há alteração ou exclusão de comprovante depois do registro nesta entrega.

## Publicação em duas fases

### 1. Preparação aditiva (aplicada em 14/10/2026)

`supabase/migrations/20261014202345_medida_comprovante_assinado_preparacao.sql`

Aplicada no projeto SGNC (`bxnuslxrlmqzytryxzvv`), com versão alinhada ao histórico remoto. Substitui a migração original não aplicada `20261014200521_medida_comprovante_assinado.sql`.

- Acrescenta as colunas opcionais, índice, bucket privado e RPC v2.
- Mantém **intacta** a implementação e os privilégios da `aplicar_medida_v1`.
- O trigger só valida integridade/imutabilidade de comprovantes presentes. Não exige foto em aplicações legadas.
- A v2 já exige foto, sem depender da ativação global. Assim, o novo Preview pode coexistir com a produção antiga.
- Storage tem RLS ativo e nenhuma política para acesso direto de anon/authenticated. Ambas as RPCs são executáveis somente por service_role/postgres; o servidor valida sessão, perfil e conflito de interesse.

### 2. Ativação global (NÃO aplicada)

`supabase/activation/medida_comprovante_obrigatorio.sql` fica deliberadamente **fora de migrations** para não ser executado por `db push` durante a preparação.

Ordem operacional:
1. Validar upload real, consulta/download e permissões no Preview.
2. Publicar o código novo em produção e validar o fluxo com foto.
3. Confirmar que não há instâncias antigas recebendo novos registros.
4. Na mesma sessão SQL, executar `SET sgnc.novo_codigo_publicado = 'confirmado';` e depois o script de ativação.
5. Executar `tests/sql/medida-comprovante-ativacao.sql` dentro de `BEGIN/ROLLBACK`.

A confirmação é uma trava operacional explícita, não uma detecção automática do deploy. A ativação exige foto nas novas aplicações por trigger e passa a rejeitar a v1. Registros históricos sem foto continuam consultáveis/editáveis. O script é transacional: qualquer erro deve causar rollback, nunca execução parcial.

Rollback da aplicação antes da ativação: a v1 continua disponível. Depois da ativação, não voltar ao código antigo sem restaurar previamente a implementação da v1 e o trigger permissivo da preparação, em uma operação coordenada. Nunca remover colunas, bucket ou arquivos durante rollback.

## Verificação desta correção

- Build, 142 testes unitários, regressões, lint e typecheck passaram.
- `tests/sql/medida-comprovante.sql` executado em `BEGIN/ROLLBACK`: v1 registra sem foto; v2 rejeita ausência/objeto inexistente; autorização, gravação atômica, reenvio e imutabilidade verificados. Nenhum registro de negócio do teste foi persistido.
- Consultas após aplicação confirmaram colunas, bucket privado (4 MiB; JPEG/PNG/WebP), RLS, ACLs e ausência de exigência global.
- O teste de ativação foi preparado, mas a ativação não foi executada no banco compartilhado.
- Advisor: nenhum achado referente aos novos objetos. Avisos já existentes: RLS sem políticas em `nc_feedbacks`/`notificacoes` e proteção contra senhas vazadas desabilitada; fora do escopo deste PR.

### Validação do Preview

O deployment anterior `798e9fd` retornou HTTP 500 antes do login. Logs da Vercel: `Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)`.

A inspeção de metadados confirmou que as três variáveis Supabase estão disponíveis em Production e, em Preview, somente na branch `claude/siga-conforme-prompt-4rd5by`. A branch deste PR não recebe nenhuma delas. É necessário configurar, especificamente para `feat/medida-comprovante-assinado`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret; apenas servidor)

Depois, gerar novo Preview e entrar com conta de teste Qualidade/Adm. Não mover as variáveis da outra branch nem alterar as de Production. Não registrar teste em medida real de funcionário: usar fixture de UAT identificada como teste.

**Upload real e testes de autorização ponta a ponta continuam pendentes.** Metadados de Storage usados no teste SQL não equivalem a envio de arquivo real. Manter PR em draft até concluir UAT.

## UAT no Preview

1. Em uma medida aprovada de outro colaborador, abrir Registrar aplicação; tentar confirmar sem foto: deve bloquear.
2. Selecionar imagem válida; confirmar o estado de foto selecionada; remover e substituir. Arquivo vazio, formato não suportado ou acima de 4 MiB deve ser recusado.
3. Simular falha no envio: data, observação e foto devem permanecer; medida continua aprovada.
4. Confirmar com foto válida: medida aplicada; abrir e baixar a foto após recarregar a página.
5. Repetir o registro em duas abas: só uma aplicação deve ser aceita.
6. Conferir medida antiga sem foto e acesso negado ao link por sessão anônima/Colaborador/Supervisor.
7. Repetir seleção e consulta no celular.
