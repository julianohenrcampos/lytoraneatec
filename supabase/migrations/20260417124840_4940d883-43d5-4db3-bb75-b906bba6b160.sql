-- Remove a antiga trava semanal
DROP INDEX IF EXISTS public.idx_unique_solicitacao_semana_cc;

-- Função de validação: bloqueia sobreposição de dias por CC em status ativos
CREATE OR REPLACE FUNCTION public.check_solicitacao_periodo_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflito RECORD;
BEGIN
  -- Ignorar se a solicitação está sendo cancelada/reprovada
  IF NEW.status IN ('cancelado', 'reprovada') THEN
    RETURN NEW;
  END IF;

  -- Buscar conflito de período no mesmo CC
  SELECT id, data_inicio, data_fim
    INTO v_conflito
  FROM public.bd_diaria_solicitacoes
  WHERE centro_custo_id = NEW.centro_custo_id
    AND id <> NEW.id
    AND status NOT IN ('cancelado', 'reprovada')
    AND daterange(data_inicio, data_fim, '[]') && daterange(NEW.data_inicio, NEW.data_fim, '[]')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PERIODO_SOBREPOSTO: Já existe solicitação ativa para este Centro de Custo cobrindo dia(s) entre % e %. Ajuste o período para não sobrepor.',
      to_char(v_conflito.data_inicio, 'DD/MM/YYYY'),
      to_char(v_conflito.data_fim, 'DD/MM/YYYY')
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_solicitacao_periodo_overlap ON public.bd_diaria_solicitacoes;

CREATE TRIGGER trg_check_solicitacao_periodo_overlap
  BEFORE INSERT OR UPDATE OF data_inicio, data_fim, status, centro_custo_id
  ON public.bd_diaria_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_solicitacao_periodo_overlap();