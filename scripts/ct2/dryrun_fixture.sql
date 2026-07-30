-- =====================================================================
-- CT-2 — FIXTURE DE DRY-RUN (PostgreSQL 17 descartavel)
-- NAO E MIGRATION. Nunca deve ser aplicado no banco vivo.
-- Reproduz o minimo necessario do estado vivo para exercitar
-- M2 R4 -> M2.1 -> M3 R3.
-- Helpers de escopo operacional/financeiro/centro de custo sao
-- reproduzidos de forma permissiva (true/false fixos) porque o alvo
-- do dry-run e a camada permission-first, nao o escopo por CC.
-- =====================================================================

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('ct2.test_uid', true), '')::uuid $$;

-- ---------------------------------------------------------------- RBAC
CREATE TABLE public.bd_roles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, nome text NOT NULL UNIQUE, descricao text, ativo boolean DEFAULT true NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.bd_user_roles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, role_id uuid NOT NULL REFERENCES public.bd_roles(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, nome_completo text, email text, acesso_global boolean, funcoes text[], funcao_sistema text, funcionario_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE public.bd_permissions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, codigo text NOT NULL UNIQUE, nome text NOT NULL, descricao text, rota text, modulo text, tipo text DEFAULT 'page'::text NOT NULL, ativo boolean DEFAULT true NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.bd_permissoes_acoes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, permission_id uuid NOT NULL REFERENCES public.bd_permissions(id) ON DELETE CASCADE, acao text NOT NULL CHECK (acao = ANY (ARRAY['visualizar','criar','editar','excluir','aprovar'])), descricao text, created_at timestamptz DEFAULT now(), UNIQUE (permission_id, acao));
CREATE TABLE public.bd_role_permission_actions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, role_id uuid NOT NULL REFERENCES public.bd_roles(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES public.bd_permissions(id) ON DELETE CASCADE, acao text NOT NULL CHECK (acao = ANY (ARRAY['visualizar','criar','editar','excluir','aprovar'])), created_at timestamptz DEFAULT now(), UNIQUE (role_id, permission_id, acao));
CREATE TABLE public.bd_user_permission_overrides (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES public.bd_permissions(id) ON DELETE CASCADE, acao text NOT NULL CHECK (acao = ANY (ARRAY['visualizar','criar','editar','excluir','aprovar'])), permitido boolean DEFAULT true NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE (user_id, permission_id, acao));

-- corpo real extraido do banco vivo (md5 prosrc 921b4a64...)
CREATE OR REPLACE FUNCTION public.user_has_permission_action(_user_id uuid, _codigo text, _acao text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_perm_id  uuid;
  v_override boolean;
  v_bypass   boolean;
  v_has      boolean;
BEGIN
  IF _user_id IS NULL OR _codigo IS NULL OR _acao IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.acesso_global IS TRUE
  )
  AND EXISTS (
    SELECT 1
    FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND lower(btrim(r.nome)) = 'superadm'
      AND r.ativo IS TRUE
  )
  INTO v_bypass;

  IF v_bypass THEN RETURN true; END IF;

  SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo = _codigo;
  IF v_perm_id IS NULL THEN RETURN false; END IF;

  SELECT permitido INTO v_override
    FROM public.bd_user_permission_overrides
   WHERE user_id = _user_id AND permission_id = v_perm_id AND acao = _acao
   LIMIT 1;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bd_user_roles ur
    JOIN public.bd_role_permission_actions rpa ON rpa.role_id = ur.role_id
    WHERE ur.user_id = _user_id AND rpa.permission_id = v_perm_id AND rpa.acao = _acao
  ) INTO v_has;

  RETURN coalesce(v_has, false);
END
$function$;

CREATE FUNCTION public.is_super_admin(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.bd_user_roles ur ON ur.user_id = p.id
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE p.id = p_user_id AND p.acesso_global IS TRUE
      AND lower(btrim(r.nome)) = 'superadm' AND r.ativo IS TRUE
  )
$$;

-- corpo real (md5 prosrc 158310ce...)
CREATE FUNCTION public.fn_is_super_admin(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.is_super_admin(p_user_id) $function$;

-- helpers de escopo reproduzidos de forma permissiva (dry-run)
CREATE FUNCTION public.fn_ativos_has_operational_access(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public.fn_ativos_has_financial_access(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.fn_ativos_can_access_centro_custo(p_cc_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;

-- ------------------------------------------------------- dominio CT-2
CREATE TABLE public.bd_centros_custo (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, codigo_centro_custo text, nome_centro_custo text);
CREATE TABLE public.bd_localizacao_equipamentos (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, equipamento_id uuid, centro_custo_id uuid, data_registro timestamptz DEFAULT now());

CREATE TABLE public.bd_catalogo_equipamentos (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tipo_equipamento_id uuid, categoria_id uuid, subcategoria_id uuid, fabricante_id uuid, modelo_id uuid, ano_fabricacao_padrao integer, capacidade text, potencia text, combustivel text, cor_padrao text, motor_padrao text, descricao_padrao text, ativo boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), imagem_url text);
CREATE TABLE public.bd_catalogo_variacoes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, subcategoria_id uuid NOT NULL, capacidade_valor numeric, capacidade_unidade text, descricao_padrao text, origem text DEFAULT 'SISTEMA' NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.bd_caminhoes_equipamentos (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, frota text, numero_frota text, placa text, situacao text DEFAULT 'Ativo', status_cadastro text DEFAULT 'ativo', status_disponibilidade text DEFAULT 'disponivel', proprietario_tipo text DEFAULT 'proprio', tipo_ativo text DEFAULT 'proprio', subcategoria_ativo_id uuid, catalogo_equipamento_id uuid, capacidade_valor numeric, capacidade_unidade text, centro_custo_atual_id uuid, centro_custo_atual_origem text DEFAULT 'SEM_ALOCACAO' NOT NULL, centro_custo_atualizado_em timestamptz, centro_custo_atualizado_por uuid, modelo text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.bd_disponibilidade_equipamentos (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, equipamento_id uuid NOT NULL, status_operacional text DEFAULT 'DISPONIVEL' NOT NULL, centro_custo_id uuid, data_inicio date, previsao_liberacao date, confiabilidade_previsao text DEFAULT 'MEDIA', motivo_risco text, observacao text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.bd_solicitacoes_equipamento (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, centro_custo_id uuid NOT NULL, solicitante_id uuid, tipo_equipamento_id uuid, quantidade integer NOT NULL DEFAULT 1, data_inicio date NOT NULL DEFAULT current_date, tempo_previsto_dias integer, regime_trabalho text, com_operador boolean, prioridade text NOT NULL DEFAULT 'NORMAL', justificativa text NOT NULL DEFAULT 'dry-run', status text NOT NULL DEFAULT 'ABERTA', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), resultado_matching text, possui_disponibilidade_interna boolean, quantidade_disponivel_encontrada integer, sugestao_acao text, engenheiro_solicitante_id uuid, apontador_responsavel_id uuid, aprovador_centro_custo_id uuid, status_fluxo text);
CREATE TABLE public.bd_solicitacoes_itens (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, solicitacao_id uuid NOT NULL REFERENCES public.bd_solicitacoes_equipamento(id) ON DELETE CASCADE, tipo_item text NOT NULL DEFAULT 'CATALOGO', catalogo_equipamento_id uuid, item_nao_catalogado boolean NOT NULL DEFAULT false, descricao_livre text, capacidade_descricao text, quantidade integer NOT NULL DEFAULT 1, com_operador boolean NOT NULL DEFAULT false, regime_trabalho text, regime_personalizado text, tempo_previsto_dias integer, observacoes text, status_item text NOT NULL DEFAULT 'PENDENTE', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), subcategoria_id uuid, capacidade_valor numeric, capacidade_unidade text, catalogo_variacao_id uuid);
CREATE TABLE public.bd_solicitacao_item_atendimentos (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, solicitacao_item_id uuid NOT NULL REFERENCES public.bd_solicitacoes_itens(id) ON DELETE CASCADE, equipamento_id uuid NOT NULL, modalidade text NOT NULL, status text DEFAULT 'RESERVADO' NOT NULL, periodo_inicio date NOT NULL, periodo_fim date NOT NULL, janela_aprovada_inicio date NOT NULL, janela_aprovada_fim date NOT NULL, override_periodo boolean DEFAULT false NOT NULL, override_disponibilidade boolean DEFAULT false NOT NULL, match_tipo text NOT NULL, justificativa_override text, contexto_decisao jsonb NOT NULL, request_id_criacao uuid NOT NULL, request_id_encerramento uuid, encerrado_em timestamptz, encerrado_por uuid, motivo_encerramento text, created_by uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);

-- Constraints da M1 exigidas pelo preflight da M2 R4 (copiadas do banco vivo)
ALTER TABLE public.bd_solicitacao_item_atendimentos
  ADD CONSTRAINT chk_sia_contexto_decisao CHECK ((jsonb_typeof(contexto_decisao) = 'object'::text)),
  ADD CONSTRAINT chk_sia_janela CHECK ((janela_aprovada_fim >= janela_aprovada_inicio)),
  ADD CONSTRAINT chk_sia_match_tipo CHECK ((match_tipo = ANY (ARRAY['EXATO'::text, 'PARCIAL'::text]))),
  ADD CONSTRAINT chk_sia_modalidade CHECK ((modalidade = ANY (ARRAY['INTERNO'::text, 'RESERVA_FUTURA'::text]))),
  ADD CONSTRAINT chk_sia_override_periodo_coerente CHECK ((override_periodo = ((periodo_inicio <> janela_aprovada_inicio) OR (periodo_fim <> janela_aprovada_fim)))),
  ADD CONSTRAINT chk_sia_periodo CHECK ((periodo_fim >= periodo_inicio)),
  ADD CONSTRAINT chk_sia_status CHECK ((status = ANY (ARRAY['RESERVADO'::text,'EM_TRANSPORTE'::text,'ENTREGUE'::text,'CANCELADO'::text,'LIBERADO'::text]))),
  ADD CONSTRAINT chk_sia_encerramento CHECK (CASE WHEN (status = ANY (ARRAY['CANCELADO'::text,'LIBERADO'::text])) THEN ((request_id_encerramento IS NOT NULL) AND (encerrado_em IS NOT NULL) AND (encerrado_por IS NOT NULL) AND (motivo_encerramento IS NOT NULL) AND (length(btrim(motivo_encerramento)) >= 20)) ELSE ((request_id_encerramento IS NULL) AND (encerrado_em IS NULL) AND (encerrado_por IS NULL) AND (motivo_encerramento IS NULL)) END),
  ADD CONSTRAINT chk_sia_justificativa_override CHECK (CASE WHEN ((match_tipo = 'PARCIAL'::text) OR override_periodo OR override_disponibilidade) THEN ((justificativa_override IS NOT NULL) AND (length(btrim(justificativa_override)) >= 20)) ELSE true END),
  ADD CONSTRAINT fk_sia_created_by FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_sia_encerrado_por FOREIGN KEY (encerrado_por) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_sia_equipamento FOREIGN KEY (equipamento_id) REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE RESTRICT;

-- Helpers de escopo com corpo real extraido do banco vivo
CREATE OR REPLACE FUNCTION public.fn_ativos_can_access_solicitacao(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.bd_solicitacoes_equipamento s
    where s.id = p_solicitacao_id
      and (
        public.fn_is_super_admin(p_user_id)
        or public.fn_ativos_has_financial_access(p_user_id)
        or s.solicitante_id = p_user_id
        or public.fn_ativos_can_access_centro_custo(s.centro_custo_id, p_user_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_ativos_can_access_equipamento(p_equipamento_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with ultima_disp as (
    select d.centro_custo_id
    from public.bd_disponibilidade_equipamentos d
    where d.equipamento_id = p_equipamento_id
    order by coalesce(d.updated_at, d.created_at) desc nulls last
    limit 1
  ), ultima_loc as (
    select l.centro_custo_id
    from public.bd_localizacao_equipamentos l
    where l.equipamento_id = p_equipamento_id
    order by l.data_registro desc nulls last
    limit 1
  )
  select public.fn_ativos_has_operational_access(p_user_id)
    and (
      public.fn_is_super_admin(p_user_id)
      or public.fn_ativos_has_financial_access(p_user_id)
      or not exists (select 1 from ultima_disp)
      or exists (select 1 from ultima_disp d where public.fn_ativos_can_access_centro_custo(d.centro_custo_id, p_user_id))
      or exists (select 1 from ultima_loc l where public.fn_ativos_can_access_centro_custo(l.centro_custo_id, p_user_id))
    );
$function$;
