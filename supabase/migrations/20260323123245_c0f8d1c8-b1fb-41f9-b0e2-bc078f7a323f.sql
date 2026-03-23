-- 1a. Campo motor_aprovacao em bd_diaria_solicitacoes
ALTER TABLE bd_diaria_solicitacoes
ADD COLUMN motor_aprovacao TEXT NOT NULL DEFAULT 'legado';

-- 1b. Tabela bd_configuracoes_sistema
CREATE TABLE bd_configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL DEFAULT 'false',
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bd_configuracoes_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read configs"
ON bd_configuracoes_sistema FOR SELECT TO authenticated USING (true);

INSERT INTO bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES ('fluxo_aprovacao_dinamico', 'false', 'Ativa motor dinamico para NOVAS solicitacoes', true);

-- 1c. RPC get_configuracao_sistema
CREATE OR REPLACE FUNCTION get_configuracao_sistema(p_chave TEXT)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT valor FROM bd_configuracoes_sistema WHERE chave = p_chave AND ativo = true),
    'false'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 1d. Atualizar iniciar_fluxo_dinamico para marcar motor_aprovacao
CREATE OR REPLACE FUNCTION iniciar_fluxo_dinamico(p_solicitacao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_centro_custo_id UUID;
  v_fluxo_id UUID;
  v_etapa RECORD;
  v_primeira BOOLEAN := true;
  v_status_nome TEXT;
  v_tipo_aprovador TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  SELECT centro_custo_id INTO v_centro_custo_id
  FROM bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id;

  IF v_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE solicitacao_id = p_solicitacao_id
  ) THEN
    RAISE EXCEPTION 'Fluxo ja foi iniciado para esta solicitacao';
  END IF;

  SELECT fcc.fluxo_id INTO v_fluxo_id
  FROM bd_fluxo_centro_custo fcc
  JOIN bd_fluxos f ON f.id = fcc.fluxo_id
  WHERE fcc.centro_custo_id = v_centro_custo_id
    AND fcc.ativo = true
    AND f.ativo = true
  LIMIT 1;

  IF v_fluxo_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum fluxo dinamico ativo encontrado para este centro de custo';
  END IF;

  UPDATE bd_diaria_solicitacoes
  SET motor_aprovacao = 'dinamico'
  WHERE id = p_solicitacao_id;

  FOR v_etapa IN
    SELECT id, nome, ordem, tipo_aprovador, usuario_especifico_id, status_fluxo_nome
    FROM bd_fluxo_etapas
    WHERE fluxo_id = v_fluxo_id AND ativo = true
    ORDER BY ordem ASC
  LOOP
    INSERT INTO bd_aprovacoes_fluxo_exec (
      solicitacao_id, etapa_id, etapa_nome_snapshot, ordem,
      status, pode_aprovar, fluxo_versao
    ) VALUES (
      p_solicitacao_id, v_etapa.id, v_etapa.nome, v_etapa.ordem,
      'pendente', v_primeira, 1
    );

    IF v_primeira THEN
      v_status_nome := v_etapa.status_fluxo_nome;
      v_tipo_aprovador := v_etapa.tipo_aprovador;
      v_primeira := false;
    END IF;
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = COALESCE(
    v_status_nome,
    CASE v_tipo_aprovador
      WHEN 'gerente_adm' THEN 'aguardando_aprovacao_gerenteadm'
      WHEN 'diretor_operacional' THEN 'aguardando_aprovacao_diretor_operacional'
      WHEN 'diretor_financeiro' THEN 'aguardando_aprovacao_diretor_adm'
      WHEN 'diretor_diretoria' THEN 'aguardando_aprovacao_diretor_adm'
      WHEN 'usuario_especifico' THEN 'aguardando_aprovacao_gerenteadm'
      ELSE 'aguardando_aprovacao_gerenteadm'
    END
  ),
  etapa_atual = 1
  WHERE id = p_solicitacao_id;
END;
$$;