ALTER TABLE bd_diaria_solicitacoes 
ADD COLUMN engenheiro_solicitante_id uuid NULL 
REFERENCES bd_funcionarios(id);