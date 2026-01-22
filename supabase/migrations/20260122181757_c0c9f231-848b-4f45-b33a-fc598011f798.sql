
-- =====================================================
-- MÓDULO SSO: REGISTRO DE DESVIOS
-- =====================================================

-- 1. Criar tabela principal de registro de desvios
CREATE TABLE public.bd_registro_desvios_sso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  gerente_regional TEXT NOT NULL,
  engenheiro_obra TEXT NOT NULL,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_relatorio TEXT,
  tecnico_seguranca TEXT NOT NULL,
  encarregado_mestre TEXT,
  tipos_desvio TEXT[] NOT NULL DEFAULT '{}',
  tipo_outros TEXT,
  analise_tecnica TEXT NOT NULL,
  adequacao_imediata TEXT,
  responsavel_acao TEXT,
  prazo_correcao DATE,
  reincidencia BOOLEAN NOT NULL DEFAULT FALSE,
  classificacao_desvio TEXT NOT NULL DEFAULT 'Leve' CHECK (classificacao_desvio IN ('Leve', 'Moderado', 'Grave', 'Crítico')),
  status_acao TEXT NOT NULL DEFAULT 'Aberto' CHECK (status_acao IN ('Aberto', 'Em Tratativa', 'Corrigido', 'Encerrado', 'Reincidente')),
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de fotos dos desvios
CREATE TABLE public.bd_registro_desvios_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id UUID NOT NULL REFERENCES public.bd_registro_desvios_sso(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  url TEXT,
  legenda TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX idx_desvios_sso_obra_id ON public.bd_registro_desvios_sso(obra_id);
CREATE INDEX idx_desvios_sso_data_registro ON public.bd_registro_desvios_sso(data_registro);
CREATE INDEX idx_desvios_sso_criado_por ON public.bd_registro_desvios_sso(criado_por);
CREATE INDEX idx_desvios_sso_status ON public.bd_registro_desvios_sso(status_acao);
CREATE INDEX idx_desvios_sso_classificacao ON public.bd_registro_desvios_sso(classificacao_desvio);
CREATE INDEX idx_desvios_fotos_registro_id ON public.bd_registro_desvios_fotos(registro_id);

-- 4. Habilitar RLS
ALTER TABLE public.bd_registro_desvios_sso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_registro_desvios_fotos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para bd_registro_desvios_sso
CREATE POLICY "Desvios SSO: SELECT para usuários autenticados"
  ON public.bd_registro_desvios_sso
  FOR SELECT
  USING (
    check_is_super_admin() 
    OR has_permission('acesso_sso_desvios')
    OR criado_por = auth.uid()
  );

CREATE POLICY "Desvios SSO: INSERT para usuários autenticados"
  ON public.bd_registro_desvios_sso
  FOR INSERT
  WITH CHECK (
    check_is_super_admin() 
    OR has_permission('acesso_sso_desvios')
  );

CREATE POLICY "Desvios SSO: UPDATE para usuários autenticados"
  ON public.bd_registro_desvios_sso
  FOR UPDATE
  USING (
    check_is_super_admin() 
    OR has_permission('acesso_sso_desvios')
    OR criado_por = auth.uid()
  )
  WITH CHECK (
    check_is_super_admin() 
    OR has_permission('acesso_sso_desvios')
    OR criado_por = auth.uid()
  );

CREATE POLICY "Desvios SSO: DELETE para admins"
  ON public.bd_registro_desvios_sso
  FOR DELETE
  USING (
    check_is_super_admin() 
    OR has_permission('acesso_sso_desvios')
  );

-- 6. Políticas RLS para bd_registro_desvios_fotos
CREATE POLICY "Desvios Fotos: SELECT para usuários autenticados"
  ON public.bd_registro_desvios_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_registro_desvios_sso d
      WHERE d.id = registro_id
      AND (
        check_is_super_admin() 
        OR has_permission('acesso_sso_desvios')
        OR d.criado_por = auth.uid()
      )
    )
  );

CREATE POLICY "Desvios Fotos: INSERT para usuários autenticados"
  ON public.bd_registro_desvios_fotos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bd_registro_desvios_sso d
      WHERE d.id = registro_id
      AND (
        check_is_super_admin() 
        OR has_permission('acesso_sso_desvios')
        OR d.criado_por = auth.uid()
      )
    )
  );

CREATE POLICY "Desvios Fotos: UPDATE para usuários autenticados"
  ON public.bd_registro_desvios_fotos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_registro_desvios_sso d
      WHERE d.id = registro_id
      AND (
        check_is_super_admin() 
        OR has_permission('acesso_sso_desvios')
        OR d.criado_por = auth.uid()
      )
    )
  );

CREATE POLICY "Desvios Fotos: DELETE para usuários autenticados"
  ON public.bd_registro_desvios_fotos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_registro_desvios_sso d
      WHERE d.id = registro_id
      AND (
        check_is_super_admin() 
        OR has_permission('acesso_sso_desvios')
        OR d.criado_por = auth.uid()
      )
    )
  );

-- 7. Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.update_desvios_sso_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_desvios_sso_updated_at
  BEFORE UPDATE ON public.bd_registro_desvios_sso
  FOR EACH ROW
  EXECUTE FUNCTION public.update_desvios_sso_updated_at();

-- 8. Função para gerar número do relatório automaticamente
CREATE OR REPLACE FUNCTION public.generate_desvio_numero_relatorio()
RETURNS TRIGGER AS $$
DECLARE
  ano_atual TEXT;
  proximo_numero INTEGER;
BEGIN
  ano_atual := EXTRACT(YEAR FROM NEW.data_registro)::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(numero_relatorio, '/', 1) AS INTEGER)
  ), 0) + 1
  INTO proximo_numero
  FROM public.bd_registro_desvios_sso
  WHERE EXTRACT(YEAR FROM data_registro) = EXTRACT(YEAR FROM NEW.data_registro);
  
  NEW.numero_relatorio := LPAD(proximo_numero::TEXT, 4, '0') || '/' || ano_atual;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_generate_desvio_numero
  BEFORE INSERT ON public.bd_registro_desvios_sso
  FOR EACH ROW
  WHEN (NEW.numero_relatorio IS NULL OR NEW.numero_relatorio = '')
  EXECUTE FUNCTION public.generate_desvio_numero_relatorio();

-- 9. Criar bucket de storage para fotos de desvios
INSERT INTO storage.buckets (id, name, public)
VALUES ('sso-desvios', 'sso-desvios', false)
ON CONFLICT (id) DO NOTHING;

-- 10. Políticas de storage para o bucket sso-desvios
CREATE POLICY "SSO Desvios: SELECT para usuários autenticados"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'sso-desvios' AND auth.uid() IS NOT NULL);

CREATE POLICY "SSO Desvios: INSERT para usuários autenticados"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'sso-desvios' AND auth.uid() IS NOT NULL);

CREATE POLICY "SSO Desvios: UPDATE para usuários autenticados"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'sso-desvios' AND auth.uid() IS NOT NULL);

CREATE POLICY "SSO Desvios: DELETE para usuários autenticados"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'sso-desvios' AND auth.uid() IS NOT NULL);

-- 11. Comentários nas tabelas
COMMENT ON TABLE public.bd_registro_desvios_sso IS 'Registros de desvios de segurança do trabalho (SSO)';
COMMENT ON TABLE public.bd_registro_desvios_fotos IS 'Fotos anexadas aos registros de desvios SSO';
