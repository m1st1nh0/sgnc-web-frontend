-- NC, workflow-history, evidence and cause-link reads go through authenticated Next.js
-- server routes (service role, scoped by profile). Keep RLS enabled as defense in depth,
-- but stop exposing raw rows/columns via the Data API.
-- evidencias/nc_causas are included because their SELECT policies query nao_conformidades:
-- once that grant is gone, direct reads on them would fail with "permission denied" anyway.
-- Rollback: GRANT SELECT ON TABLE <the same four tables> TO authenticated;
REVOKE SELECT ON TABLE public.nao_conformidades FROM anon, authenticated;
REVOKE SELECT ON TABLE public.historico_nc FROM anon, authenticated;
REVOKE SELECT ON TABLE public.evidencias FROM anon, authenticated;
REVOKE SELECT ON TABLE public.nc_causas FROM anon, authenticated;
