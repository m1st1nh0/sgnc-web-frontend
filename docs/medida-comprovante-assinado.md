# Comprovante assinado na aplicação da medida

Decisão de 14/10/2026: a aplicação pelo RH ocorre fora do SGNC. No formulário **Registrar aplicação**, data e foto assinada são obrigatórias; observação permanece opcional. Aprovação e sugestão não mudam.

## Entrega

- Uma foto JPG, PNG ou WebP de até 4 MiB, com prévia, remoção e substituição antes do registro.
- Validação no cliente, API e banco. MIME e cabeçalho binário são conferidos no servidor; legibilidade e assinatura são conferidas por quem registra.
- Arquivo no bucket privado `medidas-assinadas`. A API mantém acesso restrito à Qualidade/Adm, como a tela atual; nunca permite aplicar a própria medida.
- Upload precede a RPC `aplicar_medida_com_comprovante_v2`, que trava a medida e grava aplicação + caminho/nome numa transação. Upload malsucedido não altera a medida.
- Erro de confirmação com resultado ambíguo preserva o arquivo para não apagar comprovante já registrado. Arquivos órfãos de falhas de rede podem exigir conciliação administrativa; não há exclusão automática nesses casos.
- Links de visualizar/baixar verificam sessão e perfil a cada clique e emitem URL com 60 segundos de validade, sem cache da resposta.
- Medidas antigas continuam consultáveis sem anexo. Não há alteração ou exclusão de comprovante depois do registro nesta entrega.

## Publicação

Aplicar `supabase/migrations/20261014200521_medida_comprovante_assinado.sql` junto com a publicação da aplicação. A migração bloqueia o caminho antigo sem anexo; portanto, não deve ser aplicada isoladamente enquanto o código antigo continua recebendo registros. Um Preview com banco compartilhado também depende dessa coordenação; preferir banco isolado para UAT.

A migração foi testada em transação com ROLLBACK no projeto SGNC e **não foi aplicada permanentemente**. Nenhum registro de negócio foi alterado. O teste SQL usa metadado de objeto temporário como fixture; não substitui um upload real pelo Storage.

## Verificação executada

- `npm run lint`, `npm run typecheck`, `npm run build`: passaram.
- `npm test`: regressões e 142 testes unitários passaram.
- `tests/sql/medida-comprovante.sql`, após migração dentro de BEGIN/ROLLBACK: ausência, caminho legado, objeto inexistente, permissão, registro atômico, reenvio e imutabilidade passaram.
- Navegador local indisponível: instalação do Chromium falhou por download inválido. Validação visual e upload real ponta a ponta pendentes no Preview.

## UAT no Preview

1. Em uma medida aprovada de outro colaborador, abrir Registrar aplicação; tentar confirmar sem foto: deve bloquear.
2. Selecionar imagem válida; conferir prévia; remover e substituir. Arquivo vazio, formato não suportado ou acima de 4 MiB deve ser recusado.
3. Simular falha no envio: data, observação e foto devem permanecer; medida continua aprovada.
4. Confirmar com foto válida: medida aplicada; abrir e baixar a foto após recarregar a página.
5. Repetir o registro em duas abas: só uma aplicação deve ser aceita.
6. Conferir medida antiga sem foto e acesso negado ao link por sessão anônima/Colaborador/Supervisor.
7. Repetir seleção e consulta no celular.
