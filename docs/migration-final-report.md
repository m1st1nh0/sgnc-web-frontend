# Relatório final da migração do SGNC

## Resultado

O SGNC opera como aplicação full-stack Next.js na Vercel, usando Supabase para banco, autenticação e Storage. O frontend não encaminha mais requisições para o FastAPI no Render.

## Domínios migrados

- Autenticação SSR, login, logout e troca de senha.
- Usuários, hierarquia, ativação e desativação.
- Não conformidades, causas e transições atômicas.
- Timeline, medidas disciplinares e evidências privadas.
- Onboarding por papel.
- Estatísticas individuais e Insights V2.
- CSV detalhado e PDFs de resumo, NC e dossiê.

## Segurança

- Sessão mantida em cookies SSR.
- Chave pública/publishable no cliente.
- `SUPABASE_SERVICE_ROLE_KEY` recebe a nova secret key `sb_secret_*` somente no servidor.
- Operações privilegiadas validam sessão e papel antes do cliente administrativo.
- O catch-all de API retorna 404 e não possui fallback para serviços externos.

## Validação técnica

- TypeScript sem erros.
- ESLint sem erros; três avisos históricos permanecem no frontend legado.
- Build de produção Next.js aprovado.
- Previews Vercel criados por PR empilhado.

## Validação funcional necessária antes da produção

- ADM: usuários, abertura/avaliação/feedback, medidas, Insights e relatórios.
- Supervisor: equipe direta, Insights e dossiês autorizados.
- Funcionário: abertura, evidências, aceite e próprio dossiê.
- Abrir os quatro downloads e conferir imagens incorporadas no PDF da NC.

O repositório FastAPI permanece intacto apenas como histórico e opção de rollback, não como dependência da aplicação.
