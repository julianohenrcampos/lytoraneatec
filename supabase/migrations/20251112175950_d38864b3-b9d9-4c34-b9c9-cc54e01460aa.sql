-- ========================================
-- MÓDULO SSO - CHECKLISTS NR-18
-- ========================================

-- ========================================
-- TABELA 1: Modelo de Itens (45 itens fixos)
-- ========================================
CREATE TABLE IF NOT EXISTS bd_sso_itens_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem integer NOT NULL UNIQUE CHECK (ordem BETWEEN 1 AND 45),
  tema text NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE bd_sso_itens_modelo IS 'Modelo fixo com 45 itens de avaliação NR-18';
COMMENT ON COLUMN bd_sso_itens_modelo.ordem IS 'Ordem sequencial 1-45 conforme planilha';
COMMENT ON COLUMN bd_sso_itens_modelo.tema IS 'Agrupamento temático dos itens';

-- ========================================
-- TABELA 2: Checklists (Cabeçalho)
-- ========================================
CREATE TABLE IF NOT EXISTS bd_sso_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação da Obra
  obra_id uuid NOT NULL REFERENCES bd_centros_custo(id) ON DELETE RESTRICT,
  
  -- Equipe Responsável
  gerente_regional text NOT NULL,
  engenheiro_obra text NOT NULL,
  tecnico_seguranca text NOT NULL,
  
  -- Data da Inspeção
  data_inspecao date NOT NULL,
  
  -- Notas e Resultados (calculados automaticamente)
  nota_objetivo numeric NOT NULL DEFAULT 100 CHECK (nota_objetivo = 100),
  nota_real numeric(5,2),
  resultado_avaliacao text CHECK (resultado_avaliacao IN ('Crítico', 'Em Atenção', 'Satisfatório', 'Excelente')),
  
  -- Estatísticas
  total_itens integer NOT NULL DEFAULT 45 CHECK (total_itens = 45),
  total_aplicaveis integer CHECK (total_aplicaveis >= 0 AND total_aplicaveis <= 45),
  total_conformes integer CHECK (total_conformes >= 0),
  total_na integer CHECK (total_na >= 0 AND total_na <= 45),
  
  -- Observações Gerais
  observacoes_gerais text,
  
  -- Auditoria
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_total_itens_soma CHECK (total_aplicaveis + total_na = 45),
  CONSTRAINT chk_conformes_aplicaveis CHECK (total_conformes <= total_aplicaveis)
);

COMMENT ON TABLE bd_sso_checklists IS 'Cabeçalho dos checklists SSO NR-18';
COMMENT ON COLUMN bd_sso_checklists.nota_real IS 'Nota calculada: 100 * (conformes / aplicaveis)';
COMMENT ON COLUMN bd_sso_checklists.total_aplicaveis IS 'Itens avaliados (excluindo NA)';

-- Índices para performance
CREATE INDEX idx_sso_checklists_obra_data ON bd_sso_checklists(obra_id, data_inspecao DESC);
CREATE INDEX idx_sso_checklists_resultado ON bd_sso_checklists(resultado_avaliacao);
CREATE INDEX idx_sso_checklists_criado_por ON bd_sso_checklists(criado_por);
CREATE INDEX idx_sso_checklists_data ON bd_sso_checklists(data_inspecao DESC);

-- ========================================
-- TABELA 3: Itens Avaliados (Detalhes)
-- ========================================
CREATE TABLE IF NOT EXISTS bd_sso_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  checklist_id uuid NOT NULL REFERENCES bd_sso_checklists(id) ON DELETE CASCADE,
  item_modelo_id uuid NOT NULL REFERENCES bd_sso_itens_modelo(id) ON DELETE RESTRICT,
  
  -- Avaliação
  avaliacao text NOT NULL CHECK (avaliacao IN ('Conforme', 'Não Conforme', 'NA')),
  
  -- Evidências
  evidencia text,
  fotos jsonb DEFAULT '[]'::jsonb,
  
  -- Snapshot do item (para BI e histórico)
  ordem integer NOT NULL,
  tema text NOT NULL,
  descricao text NOT NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Garantir unicidade: 1 avaliação por item por checklist
  CONSTRAINT uq_checklist_item UNIQUE (checklist_id, item_modelo_id)
);

COMMENT ON TABLE bd_sso_checklist_itens IS 'Itens avaliados em cada checklist';
COMMENT ON COLUMN bd_sso_checklist_itens.fotos IS 'Array JSON de objetos {path, url, created_at}';
COMMENT ON COLUMN bd_sso_checklist_itens.evidencia IS 'Evidência objetiva / observações do avaliador';

-- Índices
CREATE INDEX idx_sso_itens_checklist ON bd_sso_checklist_itens(checklist_id);
CREATE INDEX idx_sso_itens_avaliacao ON bd_sso_checklist_itens(avaliacao);
CREATE INDEX idx_sso_itens_tema ON bd_sso_checklist_itens(tema);
CREATE INDEX idx_sso_itens_ordem ON bd_sso_checklist_itens(checklist_id, ordem);

-- ========================================
-- Trigger: Atualizar timestamp de modificação
-- ========================================
CREATE OR REPLACE FUNCTION trg_touch_bd_sso_checklists() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_bd_sso_checklists ON bd_sso_checklists;
CREATE TRIGGER trg_touch_bd_sso_checklists
  BEFORE UPDATE ON bd_sso_checklists
  FOR EACH ROW
  EXECUTE FUNCTION trg_touch_bd_sso_checklists();

-- ========================================
-- Função: Calcular Nota e Estatísticas do Checklist
-- ========================================
CREATE OR REPLACE FUNCTION fn_calcular_nota_checklist(p_checklist_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_aplicaveis integer;
  v_total_conformes integer;
  v_total_na integer;
  v_nota_real numeric(5,2);
  v_resultado text;
BEGIN
  -- Calcular estatísticas
  SELECT 
    COUNT(*) FILTER (WHERE avaliacao != 'NA') AS aplicaveis,
    COUNT(*) FILTER (WHERE avaliacao = 'Conforme') AS conformes,
    COUNT(*) FILTER (WHERE avaliacao = 'NA') AS na_count
  INTO v_total_aplicaveis, v_total_conformes, v_total_na
  FROM public.bd_sso_checklist_itens
  WHERE checklist_id = p_checklist_id;
  
  -- Calcular nota (normalizada por itens aplicáveis)
  IF v_total_aplicaveis = 0 THEN
    v_nota_real := NULL;
    v_resultado := NULL;
  ELSE
    v_nota_real := ROUND((100.0 * v_total_conformes / v_total_aplicaveis), 2);
    
    -- Determinar classificação
    IF v_nota_real < 50 THEN
      v_resultado := 'Crítico';
    ELSIF v_nota_real >= 50 AND v_nota_real <= 75 THEN
      v_resultado := 'Em Atenção';
    ELSIF v_nota_real >= 76 AND v_nota_real <= 90 THEN
      v_resultado := 'Satisfatório';
    ELSE
      v_resultado := 'Excelente';
    END IF;
  END IF;
  
  -- Atualizar checklist
  UPDATE public.bd_sso_checklists
  SET 
    total_aplicaveis = v_total_aplicaveis,
    total_conformes = v_total_conformes,
    total_na = v_total_na,
    nota_real = v_nota_real,
    resultado_avaliacao = v_resultado,
    atualizado_em = now()
  WHERE id = p_checklist_id;
  
  -- Retornar resultado
  RETURN json_build_object(
    'total_aplicaveis', v_total_aplicaveis,
    'total_conformes', v_total_conformes,
    'total_na', v_total_na,
    'nota_real', v_nota_real,
    'resultado_avaliacao', v_resultado
  );
END;
$$;

COMMENT ON FUNCTION fn_calcular_nota_checklist IS 'Calcula nota e estatísticas do checklist após avaliação';

-- ========================================
-- Trigger: Recalcular nota automaticamente
-- ========================================
CREATE OR REPLACE FUNCTION trg_recalcular_nota_checklist()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalcular nota do checklist pai
  PERFORM fn_calcular_nota_checklist(COALESCE(NEW.checklist_id, OLD.checklist_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_nota_insert ON bd_sso_checklist_itens;
CREATE TRIGGER trg_recalcular_nota_insert
  AFTER INSERT OR UPDATE OR DELETE ON bd_sso_checklist_itens
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalcular_nota_checklist();

-- ========================================
-- Habilitar RLS
-- ========================================
ALTER TABLE bd_sso_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE bd_sso_checklist_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bd_sso_itens_modelo ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Policies: bd_sso_checklists
-- ========================================

-- SELECT: Usuário vê checklists de obras que tem acesso
CREATE POLICY "sso_checklists_select"
  ON bd_sso_checklists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.funcoes @> ARRAY['SuperAdm']
          OR bd_sso_checklists.criado_por = auth.uid()
        )
    )
  );

-- INSERT: Apenas perfis autorizados podem criar
CREATE POLICY "sso_checklists_insert"
  ON bd_sso_checklists
  FOR INSERT
  WITH CHECK (
    criado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.funcoes && ARRAY['SuperAdm', 'Administrador', 'AdmLogistica', 'AdmRH'])
    )
  );

-- UPDATE: Apenas criador ou perfis admin podem editar
CREATE POLICY "sso_checklists_update"
  ON bd_sso_checklists
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.funcoes @> ARRAY['SuperAdm']
          OR bd_sso_checklists.criado_por = auth.uid()
        )
    )
  );

-- DELETE: Apenas criador ou SuperAdmin
CREATE POLICY "sso_checklists_delete"
  ON bd_sso_checklists
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.funcoes @> ARRAY['SuperAdm']
          OR bd_sso_checklists.criado_por = auth.uid()
        )
    )
  );

-- ========================================
-- Policies: bd_sso_checklist_itens
-- ========================================

-- Itens herdam permissões do checklist pai
CREATE POLICY "sso_itens_select"
  ON bd_sso_checklist_itens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.bd_sso_checklists c
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = bd_sso_checklist_itens.checklist_id
        AND (
          p.funcoes @> ARRAY['SuperAdm']
          OR c.criado_por = auth.uid()
        )
    )
  );

CREATE POLICY "sso_itens_insert"
  ON bd_sso_checklist_itens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.bd_sso_checklists c
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = checklist_id
        AND (c.criado_por = auth.uid() OR p.funcoes @> ARRAY['SuperAdm'])
    )
  );

CREATE POLICY "sso_itens_update"
  ON bd_sso_checklist_itens
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.bd_sso_checklists c
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = checklist_id
        AND (c.criado_por = auth.uid() OR p.funcoes @> ARRAY['SuperAdm'])
    )
  );

CREATE POLICY "sso_itens_delete"
  ON bd_sso_checklist_itens
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.bd_sso_checklists c
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = checklist_id
        AND (c.criado_por = auth.uid() OR p.funcoes @> ARRAY['SuperAdm'])
    )
  );

-- ========================================
-- Policies: bd_sso_itens_modelo (Somente leitura)
-- ========================================
CREATE POLICY "sso_modelo_select_all"
  ON bd_sso_itens_modelo
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- SuperAdmin pode gerenciar modelo
CREATE POLICY "sso_modelo_admin_all"
  ON bd_sso_itens_modelo
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.funcoes @> ARRAY['SuperAdm']
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.funcoes @> ARRAY['SuperAdm']
    )
  );

-- ========================================
-- Criar Bucket para Fotos de Checklist
-- ========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sso-checklists',
  'sso-checklists',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- Policies do Storage
-- ========================================

-- SELECT: Usuários autenticados podem ver fotos
CREATE POLICY "sso_storage_select"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'sso-checklists'
    AND auth.uid() IS NOT NULL
  );

-- INSERT: Usuários autenticados podem fazer upload
CREATE POLICY "sso_storage_insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'sso-checklists'
    AND auth.uid() IS NOT NULL
  );

-- UPDATE: Apenas o dono
CREATE POLICY "sso_storage_update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'sso-checklists'
    AND owner = auth.uid()
  );

-- DELETE: Apenas o dono
CREATE POLICY "sso_storage_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'sso-checklists'
    AND owner = auth.uid()
  );

-- ========================================
-- Inserir permissão no sistema
-- ========================================
INSERT INTO bd_permissoes (id, nome_permissao, descricao, rota)
VALUES (
  gen_random_uuid(),
  'acesso_sso_checklists',
  'Acesso ao módulo SSO - Checklists NR-18',
  '/sso/checklists'
)
ON CONFLICT (nome_permissao) DO NOTHING;