
CREATE OR REPLACE FUNCTION check_portfolio_limit()
RETURNS trigger AS $$
DECLARE
  v_estimada integer;
  v_cadastrada integer;
BEGIN
  SELECT quantidade_estimada INTO v_estimada
  FROM bd_portfolio_empresas
  WHERE empresa_id = NEW.empresa_id
    AND catalogo_equipamento_id = NEW.catalogo_equipamento_id
    AND ativo = true
  LIMIT 1;

  IF v_estimada IS NOT NULL THEN
    SELECT count(*) INTO v_cadastrada
    FROM bd_caminhoes_equipamentos
    WHERE empresa_id = NEW.empresa_id
      AND catalogo_equipamento_id = NEW.catalogo_equipamento_id;

    IF v_cadastrada >= v_estimada THEN
      RAISE EXCEPTION 'Limite do portfolio ja atingido para este equipamento (% de %)', v_cadastrada, v_estimada;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_portfolio_limit
BEFORE INSERT ON bd_caminhoes_equipamentos
FOR EACH ROW
WHEN (NEW.catalogo_equipamento_id IS NOT NULL)
EXECUTE FUNCTION check_portfolio_limit();
