-- Tabela principal de abastecimentos (cache da API GuardianWeb)
CREATE TABLE bd_abastecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  identificador text UNIQUE,
  tipo_procedimento text,
  
  -- Data e Hora
  data_abast date NOT NULL,
  hora_abast time,
  
  -- Pessoal
  comboista text,
  comboista_tag text,
  operador text,
  operador_tag text,
  
  -- Veículo
  frota text,
  frota_tag text,
  placa text,
  
  -- Combustível
  combustivel text,
  litragem numeric(10,2),
  bico text,
  estoque text,
  
  -- Medição
  medidor numeric(12,2),
  medidor_anterior_valor numeric(12,2),
  medidor_anterior_data timestamp,
  encerrante_fim numeric(12,2),
  
  -- Financeiro
  cc text,
  
  -- Localização
  latitude numeric(10,6),
  longitude numeric(10,6),
  identificacao_do_ponto text,
  
  -- Outros
  operacao text,
  medidor_via_entrada text,
  medidor_unidade text,
  codigo_terceiro text,
  foto_verificada boolean DEFAULT false,
  
  -- Auditoria
  registro_editado_em timestamp,
  registrado_editado_por text,
  data_integracao timestamp,
  
  -- Controle Interno
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_abast_data ON bd_abastecimentos(data_abast DESC);
CREATE INDEX idx_abast_frota ON bd_abastecimentos(frota);
CREATE INDEX idx_abast_placa ON bd_abastecimentos(placa);
CREATE INDEX idx_abast_cc ON bd_abastecimentos(cc);
CREATE INDEX idx_abast_comboista ON bd_abastecimentos(comboista);
CREATE INDEX idx_abast_combustivel ON bd_abastecimentos(combustivel);
CREATE INDEX idx_abast_data_frota ON bd_abastecimentos(data_abast, frota);

-- Tabela de log de sincronização
CREATE TABLE bd_abast_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  total_registros integer DEFAULT 0,
  novos_registros integer DEFAULT 0,
  atualizados integer DEFAULT 0,
  status text CHECK (status IN ('sucesso', 'erro', 'em_andamento')) DEFAULT 'em_andamento',
  mensagem_erro text,
  duracao_segundos numeric(10,2),
  executado_por uuid REFERENCES auth.users(id),
  created_at timestamp DEFAULT now()
);

-- RLS Policies para bd_abastecimentos
ALTER TABLE bd_abastecimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver abastecimentos"
  ON bd_abastecimentos FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Sistema pode gerenciar abastecimentos"
  ON bd_abastecimentos FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies para bd_abast_sync_log
ALTER TABLE bd_abast_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver sync log"
  ON bd_abast_sync_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sistema pode gerenciar sync log"
  ON bd_abast_sync_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);