BEGIN;

-- 1. ENUMs
CREATE TYPE public.chamado_interno_status AS ENUM (
  'aberto','em_triagem','em_analise','aguardando_solicitante',
  'respondido','resolvido','encerrado','reaberto','cancelado'
);

CREATE TYPE public.chamado_interno_prioridade AS ENUM (
  'baixa','normal','alta','critico'
);

CREATE TYPE public.chamado_interno_setor AS ENUM (
  'administracao','financeiro','ti','manutencao','eletrica','sso'
);

CREATE TYPE public.chamado_interno_evento_tipo AS ENUM (
  'abertura','roteamento','atribuicao','resposta_atendente',
  'resposta_solicitante','solicitacao_informacao','nota_interna',
  'mudanca_status','resolucao','confirmacao_encerramento',
  'reabertura','cancelamento'
);

-- 2. Sequência
CREATE SEQUENCE public.bd_chamados_internos_numero_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

-- 3. Categorias
CREATE TABLE public.bd_chamado_interno_categorias (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  setor public.chamado_interno_setor NOT NULL,
  sla_horas integer,
  prioridade_padrao public.chamado_interno_prioridade NOT NULL DEFAULT 'normal',
  is_critico boolean NOT NULL DEFAULT false,
  requer_evidencia boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cat_codigo_nao_vazio CHECK (btrim(codigo) <> ''),
  CONSTRAINT chk_cat_codigo_formato   CHECK (codigo ~ '^[a-z0-9_]+$'),
  CONSTRAINT chk_cat_nome_nao_vazio   CHECK (btrim(nome) <> ''),
  CONSTRAINT chk_cat_sla_positivo     CHECK (sla_horas IS NULL OR sla_horas > 0),
  CONSTRAINT chk_cat_ordem_positiva   CHECK (ordem > 0)
);

-- 4. Chamados
CREATE TABLE public.bd_chamados_internos (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  numero bigint NOT NULL,
  protocolo text NOT NULL,
  centro_custo_id uuid NOT NULL,
  categoria_id uuid NOT NULL,
  solicitante_funcionario_id uuid NOT NULL,
  aberto_por uuid NOT NULL,
  responsavel_atual_profile_id uuid,
  titulo text NOT NULL,
  descricao text NOT NULL,
  status public.chamado_interno_status NOT NULL DEFAULT 'aberto',
  setor public.chamado_interno_setor NOT NULL,
  prioridade public.chamado_interno_prioridade NOT NULL,
  is_critico boolean NOT NULL,
  sla_prazo timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ci_numero UNIQUE (numero),
  CONSTRAINT uq_ci_protocolo UNIQUE (protocolo),
  CONSTRAINT chk_ci_protocolo_formato CHECK (protocolo ~ '^CHI-[0-9]{4}-[0-9]{6}$'),
  CONSTRAINT chk_ci_titulo_nao_vazio  CHECK (btrim(titulo) <> ''),
  CONSTRAINT chk_ci_descricao_nao_vazia CHECK (btrim(descricao) <> ''),
  CONSTRAINT fk_ci_cc          FOREIGN KEY (centro_custo_id)              REFERENCES public.bd_centros_custo(id)              ON DELETE RESTRICT,
  CONSTRAINT fk_ci_categoria   FOREIGN KEY (categoria_id)                 REFERENCES public.bd_chamado_interno_categorias(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ci_solicitante FOREIGN KEY (solicitante_funcionario_id)   REFERENCES public.bd_funcionarios(id)               ON DELETE RESTRICT,
  CONSTRAINT fk_ci_aberto_por  FOREIGN KEY (aberto_por)                   REFERENCES public.profiles(id)                      ON DELETE RESTRICT,
  CONSTRAINT fk_ci_responsavel FOREIGN KEY (responsavel_atual_profile_id) REFERENCES public.profiles(id)                      ON DELETE SET NULL
);

ALTER SEQUENCE public.bd_chamados_internos_numero_seq
  OWNED BY public.bd_chamados_internos.numero;

-- 5. Eventos (append-only)
CREATE TABLE public.bd_chamado_interno_eventos (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  chamado_id uuid NOT NULL,
  tipo public.chamado_interno_evento_tipo NOT NULL,
  autor_profile_id uuid,
  mensagem text,
  status_anterior public.chamado_interno_status,
  status_novo public.chamado_interno_status,
  visivel_solicitante boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ev_chamado FOREIGN KEY (chamado_id)       REFERENCES public.bd_chamados_internos(id) ON DELETE CASCADE,
  CONSTRAINT fk_ev_autor   FOREIGN KEY (autor_profile_id) REFERENCES public.profiles(id)             ON DELETE SET NULL,
  CONSTRAINT chk_ev_payload_objeto CHECK (jsonb_typeof(payload) = 'object')
);

-- 6. Atendentes
CREATE TABLE public.bd_chamado_interno_atendentes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  atendente_profile_id uuid NOT NULL,
  setor public.chamado_interno_setor NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_at_profile_setor UNIQUE (atendente_profile_id, setor),
  CONSTRAINT fk_at_profile FOREIGN KEY (atendente_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 7. Privilégios explícitos e restritivos
REVOKE ALL PRIVILEGES ON TABLE
  public.bd_chamado_interno_categorias,
  public.bd_chamados_internos,
  public.bd_chamado_interno_eventos,
  public.bd_chamado_interno_atendentes
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON SEQUENCE public.bd_chamados_internos_numero_seq
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.bd_chamado_interno_categorias,
  public.bd_chamados_internos,
  public.bd_chamado_interno_eventos,
  public.bd_chamado_interno_atendentes
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.bd_chamado_interno_categorias,
  public.bd_chamados_internos,
  public.bd_chamado_interno_eventos,
  public.bd_chamado_interno_atendentes
TO service_role;

GRANT USAGE, SELECT, UPDATE
ON SEQUENCE public.bd_chamados_internos_numero_seq
TO service_role;

-- 8. RLS habilitada (sem policies)
ALTER TABLE public.bd_chamado_interno_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_chamados_internos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_chamado_interno_eventos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_chamado_interno_atendentes ENABLE ROW LEVEL SECURITY;

-- 9. Triggers updated_at
CREATE TRIGGER trg_bd_chamado_interno_categorias_updated_at
  BEFORE UPDATE ON public.bd_chamado_interno_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_bd_chamados_internos_updated_at
  BEFORE UPDATE ON public.bd_chamados_internos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_bd_chamado_interno_atendentes_updated_at
  BEFORE UPDATE ON public.bd_chamado_interno_atendentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Índices
CREATE INDEX idx_ci_status       ON public.bd_chamados_internos(status);
CREATE INDEX idx_ci_setor        ON public.bd_chamados_internos(setor);
CREATE INDEX idx_ci_cc           ON public.bd_chamados_internos(centro_custo_id);
CREATE INDEX idx_ci_categoria    ON public.bd_chamados_internos(categoria_id);
CREATE INDEX idx_ci_solicitante  ON public.bd_chamados_internos(solicitante_funcionario_id);
CREATE INDEX idx_ci_aberto_por   ON public.bd_chamados_internos(aberto_por);
CREATE INDEX idx_ci_responsavel  ON public.bd_chamados_internos(responsavel_atual_profile_id);
CREATE INDEX idx_ci_sla_prazo_ativos
  ON public.bd_chamados_internos(sla_prazo)
  WHERE status NOT IN ('resolvido','encerrado','cancelado');

CREATE INDEX idx_ev_chamado_created
  ON public.bd_chamado_interno_eventos(chamado_id, created_at);

CREATE INDEX idx_at_setor_ativos
  ON public.bd_chamado_interno_atendentes(setor)
  WHERE ativo;

CREATE INDEX idx_cat_setor_ativos
  ON public.bd_chamado_interno_categorias(setor)
  WHERE ativo;

-- 11. Seed idempotente estrito (10 categorias)
DO $seed$
DECLARE
  v_seed jsonb := $json$[
    {"codigo":"passagem",            "nome":"Atraso de passagem",   "descricao":null,"setor":"administracao","sla_horas":24,  "prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":1, "ativo":true},
    {"codigo":"alimentacao",         "nome":"Alimentação",          "descricao":null,"setor":"administracao","sla_horas":24,  "prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":2, "ativo":true},
    {"codigo":"diarias",             "nome":"Pagamento de diárias", "descricao":null,"setor":"financeiro",   "sla_horas":24,  "prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":3, "ativo":true},
    {"codigo":"computadores",        "nome":"Computadores",         "descricao":null,"setor":"ti",           "sla_horas":24,  "prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":4, "ativo":true},
    {"codigo":"internet",            "nome":"Internet",             "descricao":null,"setor":"ti",           "sla_horas":24,  "prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":5, "ativo":true},
    {"codigo":"manutencao",          "nome":"Manutenção",           "descricao":null,"setor":"manutencao",   "sla_horas":48,  "prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":6, "ativo":true},
    {"codigo":"eletrico",            "nome":"Chamado elétrico",     "descricao":null,"setor":"eletrica",     "sla_horas":24,  "prioridade_padrao":"alta",   "is_critico":false,"requer_evidencia":false,"ordem":7, "ativo":true},
    {"codigo":"instalacao_eletrica", "nome":"Instalação elétrica",  "descricao":null,"setor":"eletrica",     "sla_horas":null,"prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":8, "ativo":true},
    {"codigo":"acidente_trabalho",   "nome":"Acidente de trabalho", "descricao":null,"setor":"sso",          "sla_horas":null,"prioridade_padrao":"critico","is_critico":true, "requer_evidencia":false,"ordem":9, "ativo":true},
    {"codigo":"outros",              "nome":"Outros",               "descricao":null,"setor":"administracao","sla_horas":null,"prioridade_padrao":"normal", "is_critico":false,"requer_evidencia":false,"ordem":10,"ativo":true}
  ]$json$;
  r          jsonb;
  v_existing public.bd_chamado_interno_categorias%ROWTYPE;
  v_diffs    text[];
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(v_seed) LOOP
    SELECT * INTO v_existing
      FROM public.bd_chamado_interno_categorias
     WHERE codigo = r->>'codigo';

    IF NOT FOUND THEN
      INSERT INTO public.bd_chamado_interno_categorias (
        codigo, nome, descricao, setor, sla_horas,
        prioridade_padrao, is_critico, requer_evidencia, ordem, ativo
      ) VALUES (
        r->>'codigo',
        r->>'nome',
        NULLIF(r->>'descricao',''),
        (r->>'setor')::public.chamado_interno_setor,
        NULLIF(r->>'sla_horas','')::int,
        (r->>'prioridade_padrao')::public.chamado_interno_prioridade,
        (r->>'is_critico')::boolean,
        (r->>'requer_evidencia')::boolean,
        (r->>'ordem')::int,
        (r->>'ativo')::boolean
      );
    ELSE
      v_diffs := ARRAY[]::text[];
      IF v_existing.nome              IS DISTINCT FROM (r->>'nome')                                                    THEN v_diffs := v_diffs || 'nome'; END IF;
      IF v_existing.descricao         IS DISTINCT FROM NULLIF(r->>'descricao','')                                      THEN v_diffs := v_diffs || 'descricao'; END IF;
      IF v_existing.setor             IS DISTINCT FROM (r->>'setor')::public.chamado_interno_setor                     THEN v_diffs := v_diffs || 'setor'; END IF;
      IF v_existing.sla_horas         IS DISTINCT FROM NULLIF(r->>'sla_horas','')::int                                 THEN v_diffs := v_diffs || 'sla_horas'; END IF;
      IF v_existing.prioridade_padrao IS DISTINCT FROM (r->>'prioridade_padrao')::public.chamado_interno_prioridade    THEN v_diffs := v_diffs || 'prioridade_padrao'; END IF;
      IF v_existing.is_critico        IS DISTINCT FROM (r->>'is_critico')::boolean                                     THEN v_diffs := v_diffs || 'is_critico'; END IF;
      IF v_existing.requer_evidencia  IS DISTINCT FROM (r->>'requer_evidencia')::boolean                               THEN v_diffs := v_diffs || 'requer_evidencia'; END IF;
      IF v_existing.ordem             IS DISTINCT FROM (r->>'ordem')::int                                              THEN v_diffs := v_diffs || 'ordem'; END IF;
      IF v_existing.ativo             IS DISTINCT FROM (r->>'ativo')::boolean                                          THEN v_diffs := v_diffs || 'ativo'; END IF;

      IF array_length(v_diffs, 1) IS NOT NULL THEN
        RAISE EXCEPTION
          'Seed M2 divergente para categoria codigo=% ; campos divergentes=%',
          r->>'codigo', array_to_string(v_diffs, ',');
      END IF;
    END IF;
  END LOOP;
END
$seed$;

-- 12. Validação efetiva dos privilégios
DO $acl_validation$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.bd_chamado_interno_categorias',
    'public.bd_chamados_internos',
    'public.bd_chamado_interno_eventos',
    'public.bd_chamado_interno_atendentes'
  ]
  LOOP
    IF NOT has_table_privilege('authenticated', v_table, 'SELECT') THEN
      RAISE EXCEPTION 'M2 abortada: authenticated não possui SELECT em %.', v_table;
    END IF;

    IF has_table_privilege('authenticated', v_table, 'INSERT')
       OR has_table_privilege('authenticated', v_table, 'UPDATE')
       OR has_table_privilege('authenticated', v_table, 'DELETE')
       OR has_table_privilege('authenticated', v_table, 'TRUNCATE')
       OR has_table_privilege('authenticated', v_table, 'REFERENCES')
       OR has_table_privilege('authenticated', v_table, 'TRIGGER') THEN
      RAISE EXCEPTION 'M2 abortada: authenticated possui privilégio de escrita ou administração em %.', v_table;
    END IF;

    IF has_table_privilege('anon', v_table, 'SELECT')
       OR has_table_privilege('anon', v_table, 'INSERT')
       OR has_table_privilege('anon', v_table, 'UPDATE')
       OR has_table_privilege('anon', v_table, 'DELETE') THEN
      RAISE EXCEPTION 'M2 abortada: anon possui privilégios não autorizados em %.', v_table;
    END IF;
  END LOOP;

  IF has_sequence_privilege('authenticated','public.bd_chamados_internos_numero_seq','USAGE')
     OR has_sequence_privilege('authenticated','public.bd_chamados_internos_numero_seq','SELECT')
     OR has_sequence_privilege('authenticated','public.bd_chamados_internos_numero_seq','UPDATE') THEN
    RAISE EXCEPTION 'M2 abortada: authenticated possui acesso à sequência de protocolo.';
  END IF;

  IF has_sequence_privilege('anon','public.bd_chamados_internos_numero_seq','USAGE')
     OR has_sequence_privilege('anon','public.bd_chamados_internos_numero_seq','SELECT')
     OR has_sequence_privilege('anon','public.bd_chamados_internos_numero_seq','UPDATE') THEN
    RAISE EXCEPTION 'M2 abortada: anon possui acesso à sequência de protocolo.';
  END IF;

  IF NOT has_sequence_privilege('service_role','public.bd_chamados_internos_numero_seq','USAGE')
     OR NOT has_sequence_privilege('service_role','public.bd_chamados_internos_numero_seq','SELECT')
     OR NOT has_sequence_privilege('service_role','public.bd_chamados_internos_numero_seq','UPDATE') THEN
    RAISE EXCEPTION 'M2 abortada: service_role não possui todos os privilégios necessários na sequência.';
  END IF;
END;
$acl_validation$;

COMMIT;