CREATE OR REPLACE FUNCTION public.fn_rh_funcionarios_listar(
  p_search               text DEFAULT NULL,
  p_cpf                  text DEFAULT NULL,
  p_matricula            text DEFAULT NULL,
  p_status               text DEFAULT NULL,
  p_funcao_id            uuid DEFAULT NULL,
  p_departamento_id      uuid DEFAULT NULL,
  p_centro_custo_id      uuid DEFAULT NULL,
  p_empresa_id           uuid DEFAULT NULL,
  p_equipe_id            uuid DEFAULT NULL,
  p_data_admissao_inicio date DEFAULT NULL,
  p_data_admissao_fim    date DEFAULT NULL,
  p_page                 integer DEFAULT 1,
  p_page_size            integer DEFAULT 100
)
RETURNS TABLE (rows jsonb, total_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_global     boolean := false;
  v_scope_ccs  uuid[];
  v_lim        int := least(greatest(coalesce(p_page_size, 100), 1), 2000);
  v_off        int := (greatest(coalesce(p_page, 1), 1) - 1) * v_lim;
  v_cpf_digits text := CASE WHEN p_cpf IS NULL THEN NULL
                            ELSE regexp_replace(p_cpf, '\D', '', 'g') END;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_global :=
       public.fn_is_super_admin(v_uid)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND acesso_global = true)
    OR public.fn_has_role('AdmRH', v_uid)
    OR public.fn_has_role('AdmSSO', v_uid)
    OR public.fn_has_role('TecEnferSSO', v_uid)
    OR public.fn_has_role('ConsultaExames', v_uid)
    OR public.fn_has_role('AdmtreinoSSO', v_uid)
    OR public.fn_has_role('DP', v_uid)
    OR public.fn_has_role('DepartamentoPessoal', v_uid)
    OR public.fn_has_role('FinanceiroDP', v_uid);

  IF NOT v_global THEN
    IF public.fn_has_role('AdmSede', v_uid) THEN
      v_scope_ccs := ARRAY(SELECT public.get_admsede_centros_custo(v_uid));
    ELSIF public.fn_has_role('GerenteRegional', v_uid) OR public.fn_has_role('AdmOBRA', v_uid) THEN
      v_scope_ccs := ARRAY(SELECT public.fn_diaria_scope_centros_custo(v_uid));
    ELSE
      v_scope_ccs := ARRAY[]::uuid[];
    END IF;
    IF coalesce(array_length(v_scope_ccs, 1), 0) = 0 THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT f.id, f.nome_completo, f.matricula, f.status, f.cpf,
           f.data_admissao, f.data_demissao, f.imagem,
           f.funcao_id, f.departamento_id, f.centro_custo_id,
           f.empresa_id, f.equipe_id
      FROM public.bd_funcionarios f
     WHERE (v_global OR f.centro_custo_id = ANY(v_scope_ccs))
       AND (p_search IS NULL OR f.nome_completo ILIKE '%'||p_search||'%')
       AND (v_cpf_digits IS NULL OR f.cpf ILIKE '%'||v_cpf_digits||'%')
       AND (p_matricula IS NULL OR f.matricula ILIKE '%'||p_matricula||'%')
       AND (p_status IS NULL OR f.status = p_status)
       AND (p_funcao_id IS NULL OR f.funcao_id = p_funcao_id)
       AND (p_departamento_id IS NULL OR f.departamento_id = p_departamento_id)
       AND (p_centro_custo_id IS NULL OR f.centro_custo_id = p_centro_custo_id)
       AND (p_empresa_id IS NULL OR f.empresa_id = p_empresa_id)
       AND (p_equipe_id IS NULL OR f.equipe_id = p_equipe_id)
       AND (p_data_admissao_inicio IS NULL OR f.data_admissao >= p_data_admissao_inicio)
       AND (p_data_admissao_fim    IS NULL OR f.data_admissao <= p_data_admissao_fim)
  ),
  counted AS (SELECT count(*)::bigint c FROM base),
  page AS (
    SELECT b.* FROM base b
    ORDER BY b.nome_completo ASC
    OFFSET v_off LIMIT v_lim
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id',              p.id,
      'nome_completo',   p.nome_completo,
      'matricula',       p.matricula,
      'status',          p.status,
      'cpf', CASE
               WHEN p.cpf IS NULL OR length(regexp_replace(p.cpf,'\D','','g')) < 11 THEN NULL
               ELSE '***.' || substr(regexp_replace(p.cpf,'\D','','g'),4,3) || '.***-**'
             END,
      'data_admissao',   p.data_admissao,
      'data_demissao',   p.data_demissao,
      'imagem',          p.imagem,
      'funcao_id',       p.funcao_id,
      'departamento_id', p.departamento_id,
      'centro_custo_id', p.centro_custo_id,
      'empresa_id',      p.empresa_id,
      'equipe_id',       p.equipe_id,
      'bd_funcoes',
        (SELECT jsonb_build_object('id', x.id, 'nome_funcao', x.nome_funcao)
           FROM public.bd_funcoes x WHERE x.id = p.funcao_id),
      'bd_departamentos',
        (SELECT jsonb_build_object('id', x.id, 'nome_departamento', x.nome_departamento)
           FROM public.bd_departamentos x WHERE x.id = p.departamento_id),
      'bd_centros_custo',
        (SELECT jsonb_build_object('id', x.id,
                                   'codigo_centro_custo', x.codigo_centro_custo,
                                   'nome_centro_custo',  x.nome_centro_custo)
           FROM public.bd_centros_custo x WHERE x.id = p.centro_custo_id),
      'bd_empresas',
        (SELECT jsonb_build_object('id', x.id, 'nome_empresa', x.nome_empresa)
           FROM public.bd_empresas x WHERE x.id = p.empresa_id),
      'bd_equipes',
        (SELECT jsonb_build_object('id', x.id, 'nome_equipe', x.nome_equipe)
           FROM public.bd_equipes x WHERE x.id = p.equipe_id)
    ) ORDER BY p.nome_completo), '[]'::jsonb) AS rows,
    (SELECT c FROM counted) AS total_count
  FROM page p;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_rh_funcionarios_listar(
  text,text,text,text,uuid,uuid,uuid,uuid,uuid,date,date,integer,integer
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.fn_rh_funcionarios_listar(
  text,text,text,text,uuid,uuid,uuid,uuid,uuid,date,date,integer,integer
) TO authenticated;