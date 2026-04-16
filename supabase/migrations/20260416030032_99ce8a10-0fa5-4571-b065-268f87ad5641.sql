ALTER TABLE bd_funcionarios 
ADD COLUMN tipo_escala text NOT NULL DEFAULT 'normal' 
CHECK (tipo_escala IN ('normal', '12x36'));