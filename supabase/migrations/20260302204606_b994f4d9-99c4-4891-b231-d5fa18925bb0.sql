ALTER TABLE public.bd_agendamentos_exames ADD COLUMN data_resultado_exame date;

UPDATE public.bd_agendamentos_exames SET data_resultado_exame = data_agendamento 
  WHERE status IN ('Apto', 'Apto com Restrição') AND data_resultado_exame IS NULL;