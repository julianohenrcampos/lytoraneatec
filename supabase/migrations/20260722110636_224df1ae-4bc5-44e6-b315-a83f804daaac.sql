BEGIN;

DO $$
DECLARE
  v_pub_exists boolean;
  v_chamados_exists boolean;
  v_eventos_exists boolean;
  v_chamados_already boolean;
  v_eventos_already boolean;
  v_policies_m4 int;
  v_funcs_m5 int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') INTO v_pub_exists;
  IF NOT v_pub_exists THEN
    RAISE EXCEPTION 'M6 abort: publicação supabase_realtime não existe';
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='bd_chamados_internos' AND c.relkind='r') INTO v_chamados_exists;
  SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='bd_chamado_interno_eventos' AND c.relkind='r') INTO v_eventos_exists;
  IF NOT v_chamados_exists THEN
    RAISE EXCEPTION 'M6 abort: tabela public.bd_chamados_internos não existe';
  END IF;
  IF NOT v_eventos_exists THEN
    RAISE EXCEPTION 'M6 abort: tabela public.bd_chamado_interno_eventos não existe';
  END IF;

  SELECT count(*) INTO v_policies_m4
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (
      'bd_chamado_interno_categorias',
      'bd_chamados_internos',
      'bd_chamado_interno_eventos',
      'bd_chamado_interno_atendentes'
    );
  IF v_policies_m4 <> 4 THEN
    RAISE EXCEPTION 'M6 abort: esperado 4 policies M4, encontrado %', v_policies_m4;
  END IF;

  SELECT count(*) INTO v_funcs_m5
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'fn_chamado_interno_abrir',
    'fn_chamado_interno_assumir',
    'fn_chamado_interno_responder',
    'fn_chamado_interno_solicitar_informacao',
    'fn_chamado_interno_adicionar_nota_interna',
    'fn_chamado_interno_resolver',
    'fn_chamado_interno_responder_solicitante',
    'fn_chamado_interno_confirmar_encerramento',
    'fn_chamado_interno_reabrir',
    'fn_chamado_interno_cancelar'
  );
  IF v_funcs_m5 <> 10 THEN
    RAISE EXCEPTION 'M6 abort: esperado 10 funções M5, encontrado %', v_funcs_m5;
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bd_chamados_internos') INTO v_chamados_already;
  SELECT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bd_chamado_interno_eventos') INTO v_eventos_already;

  IF NOT v_chamados_already THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bd_chamados_internos';
  END IF;
  IF NOT v_eventos_already THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bd_chamado_interno_eventos';
  END IF;
END $$;

DO $$
DECLARE
  v_chamados_pub boolean;
  v_eventos_pub boolean;
  v_categorias_pub boolean;
  v_atendentes_pub boolean;
  v_policies_m4 int;
  v_funcs_m5 int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bd_chamados_internos') INTO v_chamados_pub;
  SELECT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bd_chamado_interno_eventos') INTO v_eventos_pub;
  SELECT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bd_chamado_interno_categorias') INTO v_categorias_pub;
  SELECT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bd_chamado_interno_atendentes') INTO v_atendentes_pub;

  IF NOT v_chamados_pub THEN RAISE EXCEPTION 'M6 abort pós-validação: bd_chamados_internos não publicada'; END IF;
  IF NOT v_eventos_pub THEN RAISE EXCEPTION 'M6 abort pós-validação: bd_chamado_interno_eventos não publicada'; END IF;
  IF v_categorias_pub THEN RAISE EXCEPTION 'M6 abort pós-validação: bd_chamado_interno_categorias foi publicada indevidamente'; END IF;
  IF v_atendentes_pub THEN RAISE EXCEPTION 'M6 abort pós-validação: bd_chamado_interno_atendentes foi publicada indevidamente'; END IF;

  SELECT count(*) INTO v_policies_m4
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (
      'bd_chamado_interno_categorias',
      'bd_chamados_internos',
      'bd_chamado_interno_eventos',
      'bd_chamado_interno_atendentes'
    );
  IF v_policies_m4 <> 4 THEN
    RAISE EXCEPTION 'M6 abort pós-validação: policies M4 alteradas (%).', v_policies_m4;
  END IF;

  SELECT count(*) INTO v_funcs_m5
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'fn_chamado_interno_abrir','fn_chamado_interno_assumir','fn_chamado_interno_responder',
    'fn_chamado_interno_solicitar_informacao','fn_chamado_interno_adicionar_nota_interna',
    'fn_chamado_interno_resolver','fn_chamado_interno_responder_solicitante',
    'fn_chamado_interno_confirmar_encerramento','fn_chamado_interno_reabrir','fn_chamado_interno_cancelar'
  );
  IF v_funcs_m5 <> 10 THEN
    RAISE EXCEPTION 'M6 abort pós-validação: funções M5 alteradas (%).', v_funcs_m5;
  END IF;
END $$;

COMMIT;