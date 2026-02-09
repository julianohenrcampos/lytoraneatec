-- Tabela principal bd_sso_ver_agir
CREATE TABLE public.bd_sso_ver_agir (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz,
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  
  -- Cabecalho
  obra text NOT NULL,
  local text NOT NULL,
  data_registro date NOT NULL,
  hora_registro time NOT NULL,
  tecnico_seguranca_id uuid REFERENCES public.bd_funcionarios(id),
  tecnico_seguranca_nome text NOT NULL,
  engenheiro_id uuid REFERENCES public.bd_funcionarios(id),
  engenheiro_nome text NOT NULL,
  
  -- Conteudo
  descricao_nao_conformidade text NOT NULL,
  resultado_alcancado_solucao text NOT NULL,
  
  -- Evidencias (1 imagem por campo)
  foto_antes_url text,
  foto_depois_url text,
  
  -- Gestao
  visto_gestao boolean DEFAULT false,
  visto_gestao_por uuid REFERENCES public.profiles(id),
  visto_gestao_em timestamptz,
  observacao_gestao text,
  
  -- Status
  status text NOT NULL DEFAULT 'RASCUNHO'
    CHECK (status IN ('RASCUNHO', 'ENVIADO', 'CONCLUIDO'))
);

-- Indices
CREATE INDEX idx_ver_agir_data ON public.bd_sso_ver_agir(data_registro);
CREATE INDEX idx_ver_agir_status ON public.bd_sso_ver_agir(status);
CREATE INDEX idx_ver_agir_obra ON public.bd_sso_ver_agir(obra);
CREATE INDEX idx_ver_agir_criado_por ON public.bd_sso_ver_agir(criado_por);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.trg_touch_bd_sso_ver_agir()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bd_sso_ver_agir_updated
  BEFORE UPDATE ON public.bd_sso_ver_agir
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_bd_sso_ver_agir();

-- RLS
ALTER TABLE public.bd_sso_ver_agir ENABLE ROW LEVEL SECURITY;

-- Politica SELECT
CREATE POLICY "ver_agir_select" ON public.bd_sso_ver_agir
FOR SELECT TO authenticated
USING (
  check_is_super_admin()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmSSO' = ANY(p.funcoes))
  OR criado_por = auth.uid()
);

-- Politica INSERT
CREATE POLICY "ver_agir_insert" ON public.bd_sso_ver_agir
FOR INSERT TO authenticated
WITH CHECK (has_sso_permission(auth.uid()));

-- Politica UPDATE
CREATE POLICY "ver_agir_update" ON public.bd_sso_ver_agir
FOR UPDATE TO authenticated
USING (
  check_is_super_admin()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmSSO' = ANY(p.funcoes))
  OR (criado_por = auth.uid() AND status IN ('RASCUNHO', 'ENVIADO'))
);

-- Politica DELETE
CREATE POLICY "ver_agir_delete" ON public.bd_sso_ver_agir
FOR DELETE TO authenticated
USING (
  check_is_super_admin()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmSSO' = ANY(p.funcoes))
  OR (criado_por = auth.uid() AND status = 'RASCUNHO')
);

-- Criar bucket privado para storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('sso-ver-agir', 'sso-ver-agir', false)
ON CONFLICT (id) DO NOTHING;

-- Politica de leitura storage
CREATE POLICY "ver_agir_storage_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'sso-ver-agir');

-- Politica de upload storage
CREATE POLICY "ver_agir_storage_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sso-ver-agir' AND (storage.foldername(name))[1] = 'ver-agir');

-- Politica de update storage
CREATE POLICY "ver_agir_storage_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'sso-ver-agir');

-- Politica de delete storage
CREATE POLICY "ver_agir_storage_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'sso-ver-agir');