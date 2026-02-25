ALTER TABLE public.bd_agendamentos_exames
  ADD COLUMN vt_solicitado_em DATE,
  ADD COLUMN vt_entregue_em DATE,
  ADD COLUMN vr_solicitado_em DATE,
  ADD COLUMN vr_entregue_em DATE;