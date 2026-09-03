DO $$
DECLARE
  v_base int;
  r record;
BEGIN
  SELECT COALESCE(MAX(ordem), 0) INTO v_base FROM public.bd_chamado_interno_categorias;

  FOR r IN
    SELECT * FROM (VALUES
      ('asfalto_mudanca_regras', 'Mudança de regras', 'Solicitação de análise, alteração ou orientação sobre regras operacionais relacionadas ao Setor Asfalto.', 48, 'normal', 1),
      ('asfalto_transportes', 'Transportes', 'Solicitações operacionais de transporte relacionadas às atividades do Setor Asfalto.', 24, 'alta', 2),
      ('asfalto_equipamentos', 'Equipamentos', 'Solicitações relacionadas à necessidade ou operação de equipamentos do Setor Asfalto.', 24, 'alta', 3),
      ('asfalto_descontos', 'Descontos', 'Solicitações de análise ou tratamento de descontos relacionados às operações do Setor Asfalto.', 48, 'normal', 4),
      ('asfalto_movimentacoes', 'Movimentações', 'Solicitações relacionadas a movimentações operacionais vinculadas ao Setor Asfalto.', 24, 'alta', 5)
    ) AS t(codigo, nome, descricao, sla_horas, prioridade, delta)
  LOOP
    IF EXISTS (SELECT 1 FROM public.bd_chamado_interno_categorias WHERE codigo = r.codigo) THEN
      UPDATE public.bd_chamado_interno_categorias c
         SET nome = r.nome,
             descricao = r.descricao,
             setor = 'asfalto'::public.chamado_interno_setor,
             sla_horas = r.sla_horas,
             prioridade_padrao = r.prioridade::public.chamado_interno_prioridade,
             is_critico = false,
             requer_evidencia = false,
             ativo = true
       WHERE c.codigo = r.codigo;
    ELSE
      INSERT INTO public.bd_chamado_interno_categorias
        (codigo, nome, descricao, setor, sla_horas, prioridade_padrao, is_critico, requer_evidencia, ordem, ativo)
      VALUES
        (r.codigo, r.nome, r.descricao, 'asfalto'::public.chamado_interno_setor, r.sla_horas,
         r.prioridade::public.chamado_interno_prioridade, false, false, v_base + r.delta, true);
    END IF;
  END LOOP;
END $$;