
-- 1. Update RPC to filter only active employees
DROP FUNCTION IF EXISTS public.get_funcionarios_para_diarias();

CREATE OR REPLACE FUNCTION public.get_funcionarios_para_diarias()
 RETURNS TABLE(id uuid, nome_completo text, cpf text, funcao_id uuid, centro_custo_id uuid, funcao_nome text, valor_diaria numeric, valor_diaria_exclusiva numeric, valor_refeicao numeric, matricula text, status_funcionario text, banco text, agencia text, conta_corrente text, chave_pix text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    f.centro_custo_id,
    fn.nome_funcao AS funcao_nome,
    fn.valor_diaria,
    fn.valor_diaria_exclusiva,
    fn.valor_refeicao,
    f.matricula,
    f.status AS status_funcionario,
    f.banco,
    f.agencia,
    f.conta_corrente,
    f.chave_pix
  FROM bd_funcionarios f
  LEFT JOIN bd_funcoes fn ON fn.id = f.funcao_id
  WHERE f.status IN ('Ativo', 'Ativo sem Registro')
  ORDER BY f.nome_completo;
$function$;

-- 2. Create bd_arquivo_morto table
CREATE TABLE IF NOT EXISTS public.bd_arquivo_morto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.bd_funcionarios(id),
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  motivo_desligamento TEXT,
  observacoes TEXT,
  data_desligamento DATE,
  tipo_desligamento TEXT,
  recontratavel BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bd_arquivo_morto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read arquivo_morto" ON public.bd_arquivo_morto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert arquivo_morto" ON public.bd_arquivo_morto FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Populate with existing inactive employees
INSERT INTO public.bd_arquivo_morto (funcionario_id, nome_completo, cpf, motivo_desligamento, observacoes, data_desligamento, tipo_desligamento, recontratavel)
SELECT 
  f.id,
  f.nome_completo,
  f.cpf,
  d.motivo,
  d.observacoes,
  d.data_efetiva_desligamento::date,
  d.tipo_desligamento,
  COALESCE(d.recontratavel, false)
FROM public.bd_funcionarios f
LEFT JOIN LATERAL (
  SELECT motivo, observacoes, data_efetiva_desligamento, tipo_desligamento, recontratavel
  FROM public.bd_desligamentos
  WHERE funcionario_id = f.id AND status = 'concluido'
  ORDER BY data_efetiva_desligamento DESC
  LIMIT 1
) d ON true
WHERE f.status = 'Inativo';
