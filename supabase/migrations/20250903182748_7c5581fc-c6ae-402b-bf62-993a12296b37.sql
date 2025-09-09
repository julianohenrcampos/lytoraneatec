-- Add missing fields to bd_ordens_servico table for complete OS header functionality
ALTER TABLE public.bd_ordens_servico 
ADD COLUMN IF NOT EXISTS telefone_solicitante text,
ADD COLUMN IF NOT EXISTS obra_patio text,
ADD COLUMN IF NOT EXISTS setor_executante text,
ADD COLUMN IF NOT EXISTS terceirizada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tipo_manutencao text CHECK (tipo_manutencao IN ('Corretiva', 'Preventiva')),
ADD COLUMN IF NOT EXISTS horimetro_odometro_inicial text,
ADD COLUMN IF NOT EXISTS data_inicio_atendimento date,
ADD COLUMN IF NOT EXISTS hora_inicio_atendimento time,
ADD COLUMN IF NOT EXISTS data_encerramento_atendimento date,
ADD COLUMN IF NOT EXISTS hora_encerramento_atendimento time,
ADD COLUMN IF NOT EXISTS horimetro_odometro_final text,
ADD COLUMN IF NOT EXISTS duracao_total text,
ADD COLUMN IF NOT EXISTS executado_por_id uuid,
ADD COLUMN IF NOT EXISTS encerrado_por_id uuid,
ADD COLUMN IF NOT EXISTS tratativa_solucao text;