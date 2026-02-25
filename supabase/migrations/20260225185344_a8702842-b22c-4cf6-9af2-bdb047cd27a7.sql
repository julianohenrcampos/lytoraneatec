
-- Migration: Adicionar permissões de Diárias à função AdmSSO em bd_funcoes_permissao
DO $$
DECLARE
  v_funcao_id uuid;
  v_current_permissoes uuid[];
  v_new_ids uuid[];
  v_diarias_permissions text[] := ARRAY[
    'diarias_view',
    'diarias_dashboard_view',
    'diarias_solicitacoes_view',
    'diarias_apontamento_view',
    'diarias_relatorio_view',
    'diarias_solicitar',
    'diarias_solicitar_create',
    'diarias_solicitar_edit_own',
    'diarias_solicitar_cancel_own',
    'diarias_solicitar_resend_own',
    'diarias_export',
    'diarias_exportar_excel'
  ];
BEGIN
  -- Buscar o registro da função AdmSSO
  SELECT id, permissoes::uuid[] INTO v_funcao_id, v_current_permissoes
  FROM public.bd_funcoes_permissao
  WHERE nome_funcao = 'AdmSSO';

  IF v_funcao_id IS NULL THEN
    RAISE NOTICE 'Função AdmSSO não encontrada em bd_funcoes_permissao';
    RETURN;
  END IF;

  -- Criar permissões que não existem ainda em bd_permissoes
  INSERT INTO public.bd_permissoes (nome_permissao, descricao)
  SELECT unnest(v_diarias_permissions), 'Permissão do módulo Diárias'
  ON CONFLICT DO NOTHING;

  -- Buscar UUIDs das permissões de diárias
  SELECT array_agg(DISTINCT id)
  INTO v_new_ids
  FROM public.bd_permissoes
  WHERE nome_permissao = ANY(v_diarias_permissions);

  IF v_new_ids IS NULL THEN
    RAISE NOTICE 'Nenhuma permissão de diárias encontrada';
    RETURN;
  END IF;

  -- Mesclar sem duplicar (uuid[])
  UPDATE public.bd_funcoes_permissao
  SET permissoes = (
    SELECT array_agg(DISTINCT elem)
    FROM unnest(COALESCE(v_current_permissoes, ARRAY[]::uuid[]) || v_new_ids) AS elem
  ),
  updated_at = now()
  WHERE id = v_funcao_id;

  RAISE NOTICE 'Permissões de Diárias adicionadas à função AdmSSO. IDs: %', v_new_ids;
END $$;
