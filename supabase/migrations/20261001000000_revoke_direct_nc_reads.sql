-- NC and workflow-history reads now go through authenticated Next.js server routes.
-- Keep RLS enabled as defense in depth, but do not expose raw rows/columns via Data API.
REVOKE SELECT ON TABLE public.nao_conformidades FROM anon, authenticated;
REVOKE SELECT ON TABLE public.historico_nc FROM anon, authenticated;
