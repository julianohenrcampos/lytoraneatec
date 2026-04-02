ALTER TABLE bd_locais_atendimento ADD COLUMN IF NOT EXISTS dias_atendimento text[] DEFAULT '{Segunda,Terça,Quarta,Quinta,Sexta}';
ALTER TABLE bd_locais_atendimento ADD COLUMN IF NOT EXISTS horario_inicio time DEFAULT '07:00';
ALTER TABLE bd_locais_atendimento ADD COLUMN IF NOT EXISTS horario_fim time DEFAULT '17:00';