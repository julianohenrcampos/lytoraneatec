-- Criar função para buscar último horímetro de um caminhão
CREATE OR REPLACE FUNCTION get_ultimo_horimetro_privilegiado(caminhao_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT horimetro_final 
  FROM bd_registro_apontamento_cam_equipa 
  WHERE caminhao_equipamento_id = caminhao_id 
    AND horimetro_final IS NOT NULL 
    AND horimetro_final > 0
  ORDER BY data DESC, created_at DESC 
  LIMIT 1;
$$;