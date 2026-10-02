-- Keep direct access explicitly denied while satisfying policy visibility tools.
CREATE POLICY solicitacoes_causa_explicit_deny
  ON public.solicitacoes_causa
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS solicitacoes_causa_solicitado_por_idx
  ON public.solicitacoes_causa (solicitado_por);
CREATE INDEX IF NOT EXISTS solicitacoes_causa_decidido_por_idx
  ON public.solicitacoes_causa (decidido_por);
CREATE INDEX IF NOT EXISTS solicitacoes_causa_causa_id_idx
  ON public.solicitacoes_causa (causa_id);
