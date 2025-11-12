-- Atualizar total de itens de 35 para 36
ALTER TABLE bd_sso_checklists 
  ALTER COLUMN total_itens SET DEFAULT 36;

-- Adicionar a pergunta #36 faltante
INSERT INTO bd_sso_itens_modelo (ordem, tema, descricao) VALUES
(36, 'Equipamentos - Serra Circular', 'Serra circular deve ser dotado de botão de parada de emergência?');