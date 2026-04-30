-- 1) Colunas
ALTER TABLE public.bd_diaria_presencas
  ADD COLUMN IF NOT EXISTS is_excecao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflito_solicitacao_id uuid NULL
    REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificativa_excecao text NULL,
  ADD COLUMN IF NOT EXISTS excecao_aprovada_por uuid NULL,
  ADD COLUMN IF NOT EXISTS excecao_aprovada_em timestamptz NULL;

ALTER TABLE public.bd_diaria_presencas
  DROP CONSTRAINT IF EXISTS chk_diaria_presencas_excecao_justificativa;
ALTER TABLE public.bd_diaria_presencas
  ADD CONSTRAINT chk_diaria_presencas_excecao_justificativa
  CHECK (
    is_excecao = false
    OR (
      justificativa_excecao IS NOT NULL
      AND length(trim(justificativa_excecao)) >= 20
      AND conflito_solicitacao_id IS NOT NULL
      AND excecao_aprovada_por IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_diaria_presencas_excecao
  ON public.bd_diaria_presencas (is_excecao) WHERE is_excecao = true;
CREATE INDEX IF NOT EXISTS idx_diaria_presencas_funcionario_data
  ON public.bd_diaria_presencas (funcionario_id, data);

-- 2) Trigger
CREATE OR REPLACE FUNCTION public.check_presenca_funcionario_duplicidade()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_outro_numero text;
  v_funcionario_nome text;
BEGIN
  IF NEW.is_excecao = true THEN RETURN NEW; END IF;
  IF NEW.hora_entrada IS NULL THEN RETURN NEW; END IF;

  SELECT s.numero_solicitacao INTO v_outro_numero
  FROM bd_diaria_presencas p
  JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
  WHERE p.funcionario_id = NEW.funcionario_id
    AND p.data = NEW.data
    AND p.hora_entrada IS NOT NULL
    AND p.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND p.solicitacao_id <> NEW.solicitacao_id
    AND s.status NOT IN ('cancelado','reprovada','cancelada')
  LIMIT 1;

  IF v_outro_numero IS NOT NULL THEN
    SELECT nome_completo INTO v_funcionario_nome
    FROM bd_funcionarios WHERE id = NEW.funcionario_id;
    RAISE EXCEPTION
      'FUNCIONARIO_DUPLICADO_NA_DATA: % já está em outra solicitação ativa (Nº %) na data %.',
      COALESCE(v_funcionario_nome, NEW.funcionario_id::text),
      v_outro_numero,
      to_char(NEW.data,'DD/MM/YYYY')
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) RPC elegibilidade
DROP FUNCTION IF EXISTS public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION public.fn_diaria_funcionario_elegibilidade(
  p_funcionario_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_solicitacao_id uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(
   elegivel boolean, motivo_bloqueio text, status text,
   alerta_mensagem text, conflito_solicitacao text, conflito_data date,
   conflito_solicitacao_id uuid, conflito_centro_custo text
 )
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_block_numero text; v_block_data date; v_block_id uuid; v_block_cc text;
  v_alert_numero text; v_alert_data date; v_alert_id uuid; v_alert_cc text;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(f.status), ''), 'Sem status') INTO v_status
    FROM public.bd_funcionarios f WHERE f.id = p_funcionario_id;

    IF v_status IS NULL THEN
      RETURN QUERY SELECT false, 'Funcionário não localizado para validação'::text,
        'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    IF UPPER(v_status) IN ('INATIVO','INSS','AFASTADO','FÉRIAS','FERIAS') THEN
      RETURN QUERY SELECT false, format('Funcionário com status inelegível: %s', v_status)::text,
        'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    SELECT s.numero_solicitacao, p.data, s.id,
      COALESCE(cc.codigo_centro_custo,'') ||
        CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
      INTO v_block_numero, v_block_data, v_block_id, v_block_cc
    FROM public.bd_diaria_presencas p
    JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE p.funcionario_id = p_funcionario_id
      AND p.hora_entrada IS NOT NULL
      AND p.data BETWEEN p_data_inicio AND p_data_fim
      AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
    ORDER BY p.data LIMIT 1;

    IF v_block_numero IS NOT NULL THEN
      RETURN QUERY SELECT true, NULL::text, 'alerta'::text,
        format('Funcionário já apontado na solicitação %s%s em %s. Inclusão exigirá justificativa.',
          v_block_numero,
          CASE WHEN v_block_cc <> '' THEN ' (' || v_block_cc || ')' ELSE '' END,
          to_char(v_block_data, 'DD/MM/YYYY'))::text,
        v_block_numero, v_block_data, v_block_id, v_block_cc;
      RETURN;
    END IF;

    SELECT s.numero_solicitacao, s.data_inicio, s.id,
      COALESCE(cc.codigo_centro_custo,'') ||
        CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
      INTO v_alert_numero, v_alert_data, v_alert_id, v_alert_cc
    FROM public.bd_diaria_solicitacoes s
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
      AND s.data_inicio <= p_data_fim
      AND s.data_fim    >= p_data_inicio
      AND s.convocados_pre IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.convocados_pre) AS c(item)
        WHERE (c.item->>'funcionario_id')::uuid = p_funcionario_id
      )
    ORDER BY s.data_inicio LIMIT 1;

    IF v_alert_numero IS NULL THEN
      SELECT s.numero_solicitacao, p.data, s.id,
        COALESCE(cc.codigo_centro_custo,'') ||
          CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
        INTO v_alert_numero, v_alert_data, v_alert_id, v_alert_cc
      FROM public.bd_diaria_presencas p
      JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
      LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
      WHERE p.funcionario_id = p_funcionario_id
        AND p.hora_entrada IS NULL
        AND p.data BETWEEN p_data_inicio AND p_data_fim
        AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
        AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
      ORDER BY p.data LIMIT 1;
    END IF;

    IF v_alert_numero IS NOT NULL THEN
      RETURN QUERY SELECT true, NULL::text, 'permitido'::text,
        'Funcionário previsto em outra obra, mas ainda sem apontamento. Pode prosseguir.'::text,
        v_alert_numero, v_alert_data, v_alert_id, v_alert_cc;
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text, 'livre'::text,
      NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, format('Falha na validação de elegibilidade: %s', SQLERRM)::text,
      'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
  END;
END;
$function$;

-- 4) Tabela de transferências
CREATE TABLE IF NOT EXISTS public.bd_diaria_excecao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id),
  solicitacao_origem_id uuid NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  solicitacao_destino_id uuid NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  data date NOT NULL,
  justificativa text NOT NULL CHECK (length(trim(justificativa)) >= 20),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  solicitado_por uuid NOT NULL,
  resolvido_por uuid NULL,
  resolvido_em timestamptz NULL,
  observacao_resolucao text NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diaria_excecao_solic_destino
  ON public.bd_diaria_excecao_solicitacoes (solicitacao_destino_id, status);
CREATE INDEX IF NOT EXISTS idx_diaria_excecao_solic_origem
  ON public.bd_diaria_excecao_solicitacoes (solicitacao_origem_id, status);

ALTER TABLE public.bd_diaria_excecao_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Excecao solic SELECT" ON public.bd_diaria_excecao_solicitacoes;
CREATE POLICY "Excecao solic SELECT"
  ON public.bd_diaria_excecao_solicitacoes
  FOR SELECT TO authenticated
  USING (
    solicitado_por = auth.uid()
    OR public.has_role('SuperAdm'::text, auth.uid())
    OR public.has_role('AdmObra'::text, auth.uid())
    OR public.has_role('Gerente'::text, auth.uid())
  );

DROP POLICY IF EXISTS "Excecao solic INSERT" ON public.bd_diaria_excecao_solicitacoes;
CREATE POLICY "Excecao solic INSERT"
  ON public.bd_diaria_excecao_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = auth.uid());

DROP POLICY IF EXISTS "Excecao solic UPDATE" ON public.bd_diaria_excecao_solicitacoes;
CREATE POLICY "Excecao solic UPDATE"
  ON public.bd_diaria_excecao_solicitacoes
  FOR UPDATE TO authenticated
  USING (
    public.has_role('SuperAdm'::text, auth.uid())
    OR public.has_role('AdmObra'::text, auth.uid())
    OR public.has_role('Gerente'::text, auth.uid())
  );

-- 5) View financeira
CREATE OR REPLACE VIEW public.vw_diaria_relatorio_financeiro
WITH (security_invoker = true) AS
SELECT
  p.*,
  CASE
    WHEN p.is_excecao = true THEN 'excecao_pendente'
    WHEN p.presente = true THEN 'paga'
    ELSE 'falta'
  END AS classificacao_financeira,
  CASE WHEN p.is_excecao = true THEN 0 ELSE COALESCE(p.valor_diaria_aplicada, 0) END AS valor_financeiro_efetivo,
  CASE WHEN p.is_excecao = true THEN 0 ELSE COALESCE(p.valor_refeicao_aplicado, 0) END AS valor_refeicao_efetivo
FROM public.bd_diaria_presencas p;