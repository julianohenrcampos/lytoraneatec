DO $$
DECLARE
  sol RECORD;
  elem JSONB;
  new_items JSONB;
  func_match RECORD;
  nome_conv TEXT;
  nome_norm TEXT;
  match_count INT;
  fid TEXT;
  total_fixed INT := 0;
  total_solicitacoes INT := 0;
BEGIN
  FOR sol IN
    SELECT id, convocados_pre
    FROM public.bd_diaria_solicitacoes
    WHERE convocados_pre IS NOT NULL
      AND jsonb_typeof(convocados_pre) = 'array'
      AND jsonb_array_length(convocados_pre) > 0
  LOOP
    new_items := '[]'::JSONB;
    
    FOR elem IN SELECT jsonb_array_elements(sol.convocados_pre)
    LOOP
      fid := elem ->> 'funcionario_id';
      
      IF fid IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.bd_funcionarios WHERE id = fid::UUID
      ) THEN
        nome_conv := elem ->> 'nome_funcionario';
        IF nome_conv IS NOT NULL AND nome_conv != '' THEN
          nome_norm := lower(trim(regexp_replace(nome_conv, '\s+', ' ', 'g')));
          
          SELECT COUNT(*) INTO match_count
          FROM public.bd_funcionarios
          WHERE lower(trim(regexp_replace(nome_completo, '\s+', ' ', 'g'))) = nome_norm;
          
          IF match_count = 1 THEN
            SELECT f.id, f.cpf, f.matricula INTO func_match
            FROM public.bd_funcionarios f
            WHERE lower(trim(regexp_replace(f.nome_completo, '\s+', ' ', 'g'))) = nome_norm
            LIMIT 1;
            
            new_items := new_items || jsonb_build_array(
              elem || jsonb_build_object(
                'funcionario_id', func_match.id::TEXT,
                'cpf', COALESCE(func_match.cpf, ''),
                'matricula', COALESCE(func_match.matricula, '')
              )
            );
            total_fixed := total_fixed + 1;
          ELSE
            new_items := new_items || jsonb_build_array(elem);
          END IF;
        ELSE
          new_items := new_items || jsonb_build_array(elem);
        END IF;
      ELSE
        IF (elem ->> 'cpf') IS NULL OR (elem ->> 'cpf') = '' THEN
          SELECT f.cpf, f.matricula INTO func_match
          FROM public.bd_funcionarios f
          WHERE f.id = fid::UUID;
          
          IF FOUND THEN
            new_items := new_items || jsonb_build_array(
              elem || jsonb_build_object(
                'cpf', COALESCE(func_match.cpf, ''),
                'matricula', COALESCE(func_match.matricula, '')
              )
            );
          ELSE
            new_items := new_items || jsonb_build_array(elem);
          END IF;
        ELSE
          new_items := new_items || jsonb_build_array(elem);
        END IF;
      END IF;
    END LOOP;
    
    IF new_items::TEXT != sol.convocados_pre::TEXT THEN
      UPDATE public.bd_diaria_solicitacoes
      SET convocados_pre = new_items,
          updated_at = NOW()
      WHERE id = sol.id;
      total_solicitacoes := total_solicitacoes + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Resultado: % IDs orfaos corrigidos em % solicitacoes', total_fixed, total_solicitacoes;
END;
$$;