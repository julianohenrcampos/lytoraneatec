-- Adicionar campos de contato e admissão
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS telefone_celular TEXT;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS data_inicio_prevista DATE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS data_registro_carteira DATE;

-- Checklist Documental (campos booleanos)
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_titulo_eleitor BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_pis_pasep BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_certificado_reservista BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_comprovante_residencia BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_comprovante_escolaridade BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_cnh BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_exame_toxicologico BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS doc_certidao_filhos BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS possui_carteira_digital BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS possui_conta_santander BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS banco_agencia TEXT;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS banco_conta TEXT;

-- Status de Contratação
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS carteira_assinada BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS status_integracao TEXT DEFAULT 'Sem integração';

-- Controle de etapa
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS etapa_atual INTEGER DEFAULT 1;
ALTER TABLE bd_agendamentos_exames ADD COLUMN IF NOT EXISTS etapa1_concluida BOOLEAN DEFAULT FALSE;