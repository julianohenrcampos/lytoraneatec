-- 1) Função que calcula a funcao_sistema com base no array funcoes, email SuperAdm e papéis em equipes
CREATE OR REPLACE FUNCTION public.compute_funcao_sistema(_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funcoes text[] := '{}';
  v_funcionario_id uuid;
  v_email text;
  v_role text := 'Usuário';
  v_is_apontador boolean := false;
  v_is_encarregado boolean := false;
BEGIN
  SELECT COALESCE(funcoes, '{}'), funcionario_id, email
    INTO v_funcoes, v_funcionario_id, v_email
  FROM public.profiles
  WHERE id = _profile_id;

  -- Fallback: emails de SuperAdm
  IF v_email IS NOT NULL AND lower(trim(v_email)) IN (
    'julianohcampos@yahoo.com.br',
    'ramonvalentevalente@gmail.com'
  ) THEN
    RETURN 'SuperAdm';
  END IF;

  -- Prioridade por funções do array funcoes
  IF 'SuperAdm' = ANY(v_funcoes) THEN
    RETURN 'SuperAdm';
  ELSIF 'Administrador' = ANY(v_funcoes) THEN
    RETURN 'Administrador';
  ELSIF 'AdmRH' = ANY(v_funcoes) THEN
    RETURN 'AdmRH';
  ELSIF 'AdmLogistica' = ANY(v_funcoes) THEN
    RETURN 'AdmLogistica';
  ELSIF 'AdmEquipamentos' = ANY(v_funcoes) THEN
    RETURN 'AdmEquipamentos';
  END IF;

  -- Caso não tenha funções administrativas, considerar papéis em equipes + funcoes operacionais
  IF v_funcionario_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.bd_equipes e WHERE e.encarregado_id = v_funcionario_id),
           EXISTS (SELECT 1 FROM public.bd_equipes e WHERE e.apontador_id = v_funcionario_id)
      INTO v_is_encarregado, v_is_apontador;
  END IF;

  IF v_is_encarregado OR 'Encarregado' = ANY(v_funcoes) THEN
    v_role := 'Encarregado';
  ELSIF v_is_apontador OR 'Apontador' = ANY(v_funcoes) THEN
    v_role := 'Apontador';
  ELSE
    v_role := 'Usuário';
  END IF;

  RETURN v_role;
END;
$$;

-- 2) Função que sincroniza efetivamente o campo funcao_sistema
CREATE OR REPLACE FUNCTION public.sync_profile_funcao_sistema(_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_new text;
BEGIN
  SELECT funcao_sistema INTO v_old
  FROM public.profiles WHERE id = _profile_id;

  v_new := public.compute_funcao_sistema(_profile_id);

  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE public.profiles
      SET funcao_sistema = v_new,
          updated_at = now()
    WHERE id = _profile_id;
  END IF;
END;
$$;

-- 3) Trigger em profiles para sincronizar quando funcoes ou funcionario_id mudarem
CREATE OR REPLACE FUNCTION public.trg_sync_funcao_sistema_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_profile_funcao_sistema(NEW.id);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Apagar trigger antiga se existir (idempotente)
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'after_profiles_funcoes_change'
  ) THEN
    DROP TRIGGER after_profiles_funcoes_change ON public.profiles;
  END IF;
END $$;

CREATE TRIGGER after_profiles_funcoes_change
AFTER INSERT OR UPDATE OF funcoes, funcionario_id
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_funcao_sistema_profiles();

-- 4) Trigger em bd_equipes para sincronizar perfis dos papéis afetados
CREATE OR REPLACE FUNCTION public.trg_sync_funcao_sistema_bd_equipes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Sincronizar novos papéis
  IF NEW.apontador_id IS NOT NULL THEN
    SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.funcionario_id = NEW.apontador_id LIMIT 1;
    IF v_profile_id IS NOT NULL THEN
      PERFORM public.sync_profile_funcao_sistema(v_profile_id);
    END IF;
  END IF;

  IF NEW.encarregado_id IS NOT NULL THEN
    SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.funcionario_id = NEW.encarregado_id LIMIT 1;
    IF v_profile_id IS NOT NULL THEN
      PERFORM public.sync_profile_funcao_sistema(v_profile_id);
    END IF;
  END IF;

  -- Sincronizar papéis antigos caso tenham sido removidos/trocados
  IF TG_OP = 'UPDATE' THEN
    IF OLD.apontador_id IS NOT NULL AND OLD.apontador_id IS DISTINCT FROM NEW.apontador_id THEN
      SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.funcionario_id = OLD.apontador_id LIMIT 1;
      IF v_profile_id IS NOT NULL THEN
        PERFORM public.sync_profile_funcao_sistema(v_profile_id);
      END IF;
    END IF;

    IF OLD.encarregado_id IS NOT NULL AND OLD.encarregado_id IS DISTINCT FROM NEW.encarregado_id THEN
      SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.funcionario_id = OLD.encarregado_id LIMIT 1;
      IF v_profile_id IS NOT NULL THEN
        PERFORM public.sync_profile_funcao_sistema(v_profile_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Apagar trigger antiga se existir (idempotente)
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'after_bd_equipes_role_change'
  ) THEN
    DROP TRIGGER after_bd_equipes_role_change ON public.bd_equipes;
  END IF;
END $$;

CREATE TRIGGER after_bd_equipes_role_change
AFTER INSERT OR UPDATE OF apontador_id, encarregado_id
ON public.bd_equipes
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_funcao_sistema_bd_equipes();

-- 5) Backfill imediato para alinhar todos os perfis
UPDATE public.profiles p
SET funcao_sistema = public.compute_funcao_sistema(p.id),
    updated_at = now()
WHERE public.compute_funcao_sistema(p.id) IS DISTINCT FROM p.funcao_sistema;