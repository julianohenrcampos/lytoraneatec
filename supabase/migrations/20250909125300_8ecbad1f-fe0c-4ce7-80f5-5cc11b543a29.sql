-- 1) Função de trigger para calcular duracao_total
CREATE OR REPLACE FUNCTION public.trg_calcular_duracao_atendimento_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inicio_ts timestamp;
  v_fim_ts    timestamp;
  v_interval  interval;
  v_days      integer;
  v_hours     numeric;
BEGIN
  -- Só calcula se todas as informações necessárias estiverem presentes
  IF NEW.data_inicio_atendimento IS NOT NULL
     AND NEW.hora_inicio_atendimento IS NOT NULL
     AND NEW.data_encerramento_atendimento IS NOT NULL
     AND NEW.hora_encerramento_atendimento IS NOT NULL
  THEN
    -- Combina data + hora em timestamps (sem timezone, assumindo horário local)
    v_inicio_ts := NEW.data_inicio_atendimento::timestamp + NEW.hora_inicio_atendimento;
    v_fim_ts    := NEW.data_encerramento_atendimento::timestamp + NEW.hora_encerramento_atendimento;

    -- Se encerramento for antes do início, não calcula
    IF v_fim_ts < v_inicio_ts THEN
      NEW.duracao_total := NULL;
      RETURN NEW;
    END IF;

    v_interval := v_fim_ts - v_inicio_ts;
    v_days := EXTRACT(day FROM v_interval)::int;

    IF v_days >= 1 THEN
      -- Exibe em dias inteiros
      NEW.duracao_total := v_days::text || ' dia(s)';
    ELSE
      -- Exibe em horas com 2 casas decimais
      v_hours := ROUND((EXTRACT(epoch FROM v_interval) / 3600.0)::numeric, 2);
      NEW.duracao_total := TO_CHAR(v_hours, 'FM999999990D00') || ' hora(s)';
    END IF;
  ELSE
    -- Campos insuficientes para cálculo
    NEW.duracao_total := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger BEFORE INSERT/UPDATE para manter duracao_total sempre atualizada
DROP TRIGGER IF EXISTS trg_calcular_duracao_atendimento ON public.bd_ordens_servico;
CREATE TRIGGER trg_calcular_duracao_atendimento
BEFORE INSERT OR UPDATE OF 
  data_inicio_atendimento,
  hora_inicio_atendimento,
  data_encerramento_atendimento,
  hora_encerramento_atendimento
ON public.bd_ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.trg_calcular_duracao_atendimento_fn();