-- 1. Adicionar coluna etapa_vistoria na tabela bd_sso_checklists (sem constraint ainda)
ALTER TABLE public.bd_sso_checklists 
ADD COLUMN IF NOT EXISTS etapa_vistoria text DEFAULT '1ª Etapa';

-- 2. Atualizar registros existentes com etapas sequenciais por obra (baseado na data)
WITH ranked_checklists AS (
  SELECT 
    id,
    obra_id,
    data_inspecao,
    ROW_NUMBER() OVER (PARTITION BY obra_id ORDER BY data_inspecao ASC) as rn
  FROM bd_sso_checklists
)
UPDATE bd_sso_checklists c
SET etapa_vistoria = CASE 
    WHEN r.rn = 1 THEN '1ª Etapa'
    WHEN r.rn = 2 THEN '2ª Etapa'
    WHEN r.rn = 3 THEN '3ª Etapa'
    WHEN r.rn = 4 THEN '4ª Etapa'
    ELSE '1ª Etapa'
  END
FROM ranked_checklists r
WHERE c.id = r.id;

-- 3. Agora adicionar a constraint CHECK e NOT NULL
ALTER TABLE public.bd_sso_checklists 
ALTER COLUMN etapa_vistoria SET NOT NULL;

ALTER TABLE public.bd_sso_checklists 
ADD CONSTRAINT chk_etapa_vistoria CHECK (etapa_vistoria IN ('1ª Etapa', '2ª Etapa', '3ª Etapa', '4ª Etapa'));

-- 4. Criar índice único para impedir duplicatas de obra + etapa
CREATE UNIQUE INDEX idx_unique_obra_etapa 
ON public.bd_sso_checklists (obra_id, etapa_vistoria);

-- 5. Criar função para verificar vistorias pendentes (5 dias antes de 3 meses)
CREATE OR REPLACE FUNCTION public.check_vistorias_sso_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  vistoria RECORD;
  notif_id uuid;
  admin_user uuid;
BEGIN
  FOR vistoria IN
    WITH ultima_vistoria AS (
      SELECT DISTINCT ON (obra_id)
        c.id,
        c.obra_id,
        c.tecnico_seguranca,
        c.etapa_vistoria,
        c.data_inspecao,
        c.criado_por,
        cc.nome_centro_custo
      FROM bd_sso_checklists c
      JOIN bd_centros_custo cc ON c.obra_id = cc.id
      ORDER BY c.obra_id, c.data_inspecao DESC
    )
    SELECT * FROM ultima_vistoria
    WHERE data_inspecao = CURRENT_DATE - INTERVAL '85 days'
      AND etapa_vistoria != '4ª Etapa'
      AND NOT EXISTS (
        SELECT 1 FROM bd_notificacoes n
        WHERE n.tipo = 'sso_vistoria_pendente'
          AND n.metadata->>'obra_id' = obra_id::text
          AND n.created_at > CURRENT_DATE - INTERVAL '7 days'
      )
  LOOP
    INSERT INTO bd_notificacoes (tipo, titulo, mensagem, link, metadata, created_by)
    VALUES (
      'sso_vistoria_pendente',
      'Vistoria SSO Pendente',
      'A obra "' || vistoria.nome_centro_custo || '" precisa de nova vistoria em 5 dias. Última etapa: ' || vistoria.etapa_vistoria,
      '/sso/checklists',
      jsonb_build_object(
        'obra_id', vistoria.obra_id,
        'obra_nome', vistoria.nome_centro_custo,
        'ultima_etapa', vistoria.etapa_vistoria,
        'data_ultima_inspecao', vistoria.data_inspecao,
        'tecnico_seguranca', vistoria.tecnico_seguranca
      ),
      vistoria.criado_por
    )
    RETURNING id INTO notif_id;
    
    IF vistoria.criado_por IS NOT NULL THEN
      INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
      VALUES (notif_id, vistoria.criado_por)
      ON CONFLICT DO NOTHING;
    END IF;
    
    FOR admin_user IN
      SELECT p.id FROM profiles p
      WHERE 'AdmSSO' = ANY(p.funcoes) OR 'SuperAdm' = ANY(p.funcoes)
    LOOP
      IF admin_user IS DISTINCT FROM vistoria.criado_por THEN
        INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
        VALUES (notif_id, admin_user)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- 6. Criar função para verificar etapa disponível
CREATE OR REPLACE FUNCTION public.verificar_etapa_disponivel(
  p_obra_id uuid,
  p_etapa text,
  p_checklist_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_checklist_id IS NOT NULL THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM bd_sso_checklists
      WHERE obra_id = p_obra_id
        AND etapa_vistoria = p_etapa
        AND id != p_checklist_id
    );
  ELSE
    RETURN NOT EXISTS (
      SELECT 1 FROM bd_sso_checklists
      WHERE obra_id = p_obra_id
        AND etapa_vistoria = p_etapa
    );
  END IF;
END;
$function$;

-- 7. Criar função para buscar etapas já utilizadas de uma obra
CREATE OR REPLACE FUNCTION public.get_etapas_utilizadas(p_obra_id uuid, p_checklist_id uuid DEFAULT NULL)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(ARRAY_AGG(etapa_vistoria), ARRAY[]::text[])
  FROM bd_sso_checklists
  WHERE obra_id = p_obra_id
    AND (p_checklist_id IS NULL OR id != p_checklist_id);
$function$;