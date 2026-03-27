
-- ETAPA 1: Adicionar novas colunas FK e renavam
ALTER TABLE public.bd_caminhoes_equipamentos
  ADD COLUMN IF NOT EXISTS frota_id uuid REFERENCES public.bd_frotas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_equipamento_id uuid REFERENCES public.bd_tipos_equipamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fabricante_id uuid REFERENCES public.bd_fabricantes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES public.bd_modelos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renavam text;

-- ETAPA 2: Índices antifraude (excluindo placeholders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_placa_unica
  ON public.bd_caminhoes_equipamentos (UPPER(TRIM(placa)))
  WHERE placa IS NOT NULL 
    AND TRIM(placa) != '' 
    AND TRIM(placa) != '-'
    AND TRIM(placa) != '--'
    AND UPPER(TRIM(placa)) NOT IN ('N/A', 'S/N', 'NA', 'SN', 'S/PLACA');

CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_chassi_unico
  ON public.bd_caminhoes_equipamentos (UPPER(TRIM(chassi)))
  WHERE chassi IS NOT NULL 
    AND TRIM(chassi) != '' 
    AND TRIM(chassi) != '-'
    AND UPPER(TRIM(chassi)) NOT IN ('N/A', 'S/N', 'NA', 'SN');

CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_numserie_unico
  ON public.bd_caminhoes_equipamentos (UPPER(TRIM(numero_serie)))
  WHERE numero_serie IS NOT NULL 
    AND TRIM(numero_serie) != '' 
    AND TRIM(numero_serie) != '-'
    AND UPPER(TRIM(numero_serie)) NOT IN ('N/A', 'S/N', 'NA', 'SN');

CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_renavam_unico
  ON public.bd_caminhoes_equipamentos (UPPER(TRIM(renavam)))
  WHERE renavam IS NOT NULL 
    AND TRIM(renavam) != '' 
    AND TRIM(renavam) != '-'
    AND UPPER(TRIM(renavam)) NOT IN ('N/A', 'S/N', 'NA', 'SN');

-- ETAPA 3: Índices de performance nas FKs
CREATE INDEX IF NOT EXISTS idx_equip_frota_id ON public.bd_caminhoes_equipamentos (frota_id);
CREATE INDEX IF NOT EXISTS idx_equip_tipo_equipamento_id ON public.bd_caminhoes_equipamentos (tipo_equipamento_id);
CREATE INDEX IF NOT EXISTS idx_equip_fabricante_id ON public.bd_caminhoes_equipamentos (fabricante_id);
CREATE INDEX IF NOT EXISTS idx_equip_modelo_id ON public.bd_caminhoes_equipamentos (modelo_id);

-- ETAPA 4: Função de verificação antifraude
CREATE OR REPLACE FUNCTION public.verificar_equipamento_duplicado(
  p_placa text DEFAULT NULL,
  p_chassi text DEFAULT NULL,
  p_numero_serie text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  campo_duplicado text,
  valor_encontrado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_placa IS NOT NULL AND TRIM(p_placa) != '' AND TRIM(p_placa) != '-' THEN
    RETURN QUERY
    SELECT e.id, 'placa'::text, e.placa
    FROM public.bd_caminhoes_equipamentos e
    WHERE UPPER(TRIM(e.placa)) = UPPER(TRIM(p_placa));
  END IF;

  IF p_chassi IS NOT NULL AND TRIM(p_chassi) != '' AND TRIM(p_chassi) != '-' THEN
    RETURN QUERY
    SELECT e.id, 'chassi'::text, e.chassi
    FROM public.bd_caminhoes_equipamentos e
    WHERE UPPER(TRIM(e.chassi)) = UPPER(TRIM(p_chassi));
  END IF;

  IF p_numero_serie IS NOT NULL AND TRIM(p_numero_serie) != '' AND TRIM(p_numero_serie) != '-' THEN
    RETURN QUERY
    SELECT e.id, 'numero_serie'::text, e.numero_serie
    FROM public.bd_caminhoes_equipamentos e
    WHERE UPPER(TRIM(e.numero_serie)) = UPPER(TRIM(p_numero_serie));
  END IF;
END;
$$;
