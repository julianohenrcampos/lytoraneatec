ALTER TABLE bd_centros_custo
ADD COLUMN adm_sede_funcionario_id uuid REFERENCES bd_funcionarios(id);