-- Create OS related tables if they do not exist
-- 1) Movimentações da OS
CREATE TABLE IF NOT EXISTS public.bd_os_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL,
  data_movimentacao date NOT NULL DEFAULT CURRENT_DATE,
  hora_movimentacao time without time zone NOT NULL DEFAULT CURRENT_TIME,
  usuario_id uuid,
  motivo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- FK to bd_ordens_servico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bd_os_movimentacoes_os_id'
  ) THEN
    ALTER TABLE public.bd_os_movimentacoes
      ADD CONSTRAINT fk_bd_os_movimentacoes_os_id
      FOREIGN KEY (os_id) REFERENCES public.bd_ordens_servico(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Materiais utilizados na OS
CREATE TABLE IF NOT EXISTS public.bd_os_materiais_utilizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL,
  quantidade numeric NOT NULL,
  descricao_material text NOT NULL,
  valor_unitario numeric NOT NULL,
  valor_total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bd_os_materiais_utilizados_os_id'
  ) THEN
    ALTER TABLE public.bd_os_materiais_utilizados
      ADD CONSTRAINT fk_bd_os_materiais_utilizados_os_id
      FOREIGN KEY (os_id) REFERENCES public.bd_ordens_servico(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Mão de obra da OS
CREATE TABLE IF NOT EXISTS public.bd_os_mao_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL,
  quantidade numeric NOT NULL,
  funcao text NOT NULL,
  valor_unitario numeric NOT NULL,
  valor_total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bd_os_mao_obra_os_id'
  ) THEN
    ALTER TABLE public.bd_os_mao_obra
      ADD CONSTRAINT fk_bd_os_mao_obra_os_id
      FOREIGN KEY (os_id) REFERENCES public.bd_ordens_servico(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.bd_os_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_os_materiais_utilizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_os_mao_obra ENABLE ROW LEVEL SECURITY;

-- Policies: allow authenticated users (pattern consistent with other tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bd_os_movimentacoes'
  ) THEN
    CREATE POLICY "Usuários autenticados podem acessar os movimentacoes" ON public.bd_os_movimentacoes
      FOR SELECT USING (true);
    CREATE POLICY "Usuários autenticados podem inserir os movimentacoes" ON public.bd_os_movimentacoes
      FOR INSERT WITH CHECK (true);
    CREATE POLICY "Usuários autenticados podem atualizar os movimentacoes" ON public.bd_os_movimentacoes
      FOR UPDATE USING (true);
    CREATE POLICY "Usuários autenticados podem deletar os movimentacoes" ON public.bd_os_movimentacoes
      FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bd_os_materiais_utilizados'
  ) THEN
    CREATE POLICY "Usuários autenticados podem acessar os materiais" ON public.bd_os_materiais_utilizados
      FOR SELECT USING (true);
    CREATE POLICY "Usuários autenticados podem inserir os materiais" ON public.bd_os_materiais_utilizados
      FOR INSERT WITH CHECK (true);
    CREATE POLICY "Usuários autenticados podem atualizar os materiais" ON public.bd_os_materiais_utilizados
      FOR UPDATE USING (true);
    CREATE POLICY "Usuários autenticados podem deletar os materiais" ON public.bd_os_materiais_utilizados
      FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bd_os_mao_obra'
  ) THEN
    CREATE POLICY "Usuários autenticados podem acessar os mao_obra" ON public.bd_os_mao_obra
      FOR SELECT USING (true);
    CREATE POLICY "Usuários autenticados podem inserir os mao_obra" ON public.bd_os_mao_obra
      FOR INSERT WITH CHECK (true);
    CREATE POLICY "Usuários autenticados podem atualizar os mao_obra" ON public.bd_os_mao_obra
      FOR UPDATE USING (true);
    CREATE POLICY "Usuários autenticados podem deletar os mao_obra" ON public.bd_os_mao_obra
      FOR DELETE USING (true);
  END IF;
END $$;

-- Triggers to keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bd_os_movimentacoes_updated_at'
  ) THEN
    CREATE TRIGGER trg_bd_os_movimentacoes_updated_at
    BEFORE UPDATE ON public.bd_os_movimentacoes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bd_os_materiais_utilizados_updated_at'
  ) THEN
    CREATE TRIGGER trg_bd_os_materiais_utilizados_updated_at
    BEFORE UPDATE ON public.bd_os_materiais_utilizados
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bd_os_mao_obra_updated_at'
  ) THEN
    CREATE TRIGGER trg_bd_os_mao_obra_updated_at
    BEFORE UPDATE ON public.bd_os_mao_obra
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;