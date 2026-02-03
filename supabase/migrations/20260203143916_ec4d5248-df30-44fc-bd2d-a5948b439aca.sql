-- Adicionar coluna numero_solicitacao
ALTER TABLE bd_diaria_solicitacoes 
ADD COLUMN numero_solicitacao VARCHAR(10);

-- Gerar números para registros existentes (ordenados por created_at)
WITH numbered AS (
  SELECT 
    id,
    EXTRACT(YEAR FROM created_at)::text || '-' || 
    LPAD(ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at) 
      ORDER BY created_at
    )::text, 3, '0') as numero
  FROM bd_diaria_solicitacoes
)
UPDATE bd_diaria_solicitacoes s
SET numero_solicitacao = n.numero
FROM numbered n
WHERE s.id = n.id;

-- Tornar NOT NULL após popular dados existentes
ALTER TABLE bd_diaria_solicitacoes 
ALTER COLUMN numero_solicitacao SET NOT NULL;

-- Adicionar constraint UNIQUE
ALTER TABLE bd_diaria_solicitacoes 
ADD CONSTRAINT bd_diaria_solicitacoes_numero_unique UNIQUE (numero_solicitacao);

-- Criar índice para buscas
CREATE INDEX idx_diaria_solicitacoes_numero 
ON bd_diaria_solicitacoes(numero_solicitacao);

-- Atualizar view de relatório para incluir numero_solicitacao
DROP VIEW IF EXISTS vw_relatorio_diarias_folha;

CREATE VIEW vw_relatorio_diarias_folha AS
SELECT 
  p.id as presenca_id,
  p.solicitacao_id,
  dsol.numero_solicitacao,
  p.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  p.funcionario_id,
  f.nome_completo as nome_funcionario,
  p.funcao_id,
  func.nome_funcao,
  p.valor_diaria_aplicada,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  p.presente::text as presenca_status,
  p.confirmado_por,
  p.confirmado_em,
  dsol.status as status_solicitacao,
  dsol.criado_por as solicitante_id,
  sol_profile.nome_completo as solicitante_nome,
  apto.responsavel_campo_id as apontador_id,
  apt_func.nome_completo as apontador_nome,
  p.created_at
FROM bd_diaria_presencas p
INNER JOIN bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
INNER JOIN bd_centros_custo cc ON dsol.centro_custo_id = cc.id
INNER JOIN bd_funcionarios f ON p.funcionario_id = f.id
LEFT JOIN bd_funcoes func ON p.funcao_id = func.id
LEFT JOIN profiles sol_profile ON dsol.criado_por = sol_profile.id
LEFT JOIN bd_diaria_apontamentos apto ON dsol.id = apto.solicitacao_id
LEFT JOIN bd_funcionarios apt_func ON apto.responsavel_campo_id = apt_func.id
ORDER BY p.data DESC, f.nome_completo ASC;