
-- 1. Add funcao_nova_id to bd_agendamentos_exames
ALTER TABLE public.bd_agendamentos_exames
ADD COLUMN IF NOT EXISTS funcao_nova_id UUID REFERENCES public.bd_funcoes(id);

-- 2. Create bd_historico_funcional table
CREATE TABLE IF NOT EXISTS public.bd_historico_funcional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  cargo_anterior TEXT,
  cargo_novo TEXT,
  salario_anterior NUMERIC,
  salario_novo NUMERIC,
  percentual_aumento NUMERIC,
  centro_custo_anterior TEXT,
  centro_custo_novo TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.bd_historico_funcional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view career history"
ON public.bd_historico_funcional
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert career history"
ON public.bd_historico_funcional
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Trigger function for promotion processing
CREATE OR REPLACE FUNCTION public.fn_processar_promocao()
RETURNS TRIGGER AS $$
DECLARE
  v_funcionario RECORD;
  v_funcao_nova RECORD;
  v_percentual NUMERIC;
  v_centro_custo_nome TEXT;
BEGIN
  -- Only process for Mudança de Risco when status changes to Apto
  IF NEW.tipo_exame = 'Mudança de Risco'
     AND NEW.funcao_nova_id IS NOT NULL
     AND NEW.status IN ('Apto', 'Apto com Restrição')
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    -- Get current employee data
    SELECT f.*, fn.nome_funcao as funcao_atual_nome, fn.salario_base as funcao_atual_salario
    INTO v_funcionario
    FROM public.bd_funcionarios f
    LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
    WHERE f.id = (
      SELECT bf.id FROM public.bd_funcionarios bf WHERE bf.cpf = NEW.cpf LIMIT 1
    );

    IF v_funcionario.id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get new function data
    SELECT * INTO v_funcao_nova
    FROM public.bd_funcoes
    WHERE id = NEW.funcao_nova_id;

    IF v_funcao_nova.id IS NULL THEN
      RAISE EXCEPTION 'Função nova não encontrada (id: %)', NEW.funcao_nova_id;
    END IF;

    -- Calculate percentage increase
    IF v_funcionario.funcao_atual_salario IS NOT NULL AND v_funcionario.funcao_atual_salario > 0 THEN
      v_percentual := ((v_funcao_nova.salario_base - v_funcionario.funcao_atual_salario) / v_funcionario.funcao_atual_salario) * 100;
    ELSE
      v_percentual := NULL;
    END IF;

    -- Get centro_custo name
    SELECT nome_centro_custo INTO v_centro_custo_nome
    FROM public.bd_centros_custo
    WHERE id = v_funcionario.centro_custo_id;

    -- Insert career history
    INSERT INTO public.bd_historico_funcional (
      funcionario_id, tipo_evento, cargo_anterior, cargo_novo,
      salario_anterior, salario_novo, percentual_aumento,
      centro_custo_anterior, centro_custo_novo, motivo
    ) VALUES (
      v_funcionario.id,
      'PROMOCAO',
      v_funcionario.funcao_atual_nome,
      v_funcao_nova.nome_funcao,
      v_funcionario.funcao_atual_salario,
      v_funcao_nova.salario_base,
      v_percentual,
      v_centro_custo_nome,
      v_centro_custo_nome,
      COALESCE(NEW.motivo_mudanca_risco, 'Mudança de risco')
    );

    -- Update employee
    UPDATE public.bd_funcionarios
    SET funcao_id = NEW.funcao_nova_id
    WHERE id = v_funcionario.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create trigger
DROP TRIGGER IF EXISTS trg_processar_promocao ON public.bd_agendamentos_exames;
CREATE TRIGGER trg_processar_promocao
  AFTER INSERT OR UPDATE ON public.bd_agendamentos_exames
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_processar_promocao();
