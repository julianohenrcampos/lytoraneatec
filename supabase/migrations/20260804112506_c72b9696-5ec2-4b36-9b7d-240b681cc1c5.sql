BEGIN;

CREATE TABLE public.bd_pops (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo                      text NOT NULL,
  titulo                      text NOT NULL,
  setor_id                    uuid NOT NULL,
  categoria                   text NULL,
  status                      text NOT NULL DEFAULT 'rascunho',
  versao_major                integer NOT NULL DEFAULT 1,
  versao_minor                integer NOT NULL DEFAULT 0,
  arquivo_path                text NULL,
  arquivo_nome_original       text NULL,
  arquivo_mime_type           text NULL,
  arquivo_tamanho_bytes       bigint NULL,
  arquivo_sha256              text NULL,
  elaborado_por_id            uuid NULL,
  elaborado_por_nome_snapshot text NULL,
  aprovado_por                uuid NULL,
  publicado_em                timestamptz NULL,
  criado_por                  uuid NOT NULL,
  atualizado_por              uuid NULL,
  obsoleto_em                 timestamptz NULL,
  obsoleto_por                uuid NULL,
  motivo_obsolescencia        text NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_bd_pops PRIMARY KEY (id),
  CONSTRAINT fk_bd_pops_setor FOREIGN KEY (setor_id)
    REFERENCES public.bd_departamentos (id) ON DELETE RESTRICT,
  CONSTRAINT chk_bd_pops_status
    CHECK (status IN ('rascunho','ativo','obsoleto')),
  CONSTRAINT chk_bd_pops_codigo_nao_vazio CHECK (btrim(codigo) <> ''),
  CONSTRAINT chk_bd_pops_titulo_nao_vazio CHECK (btrim(titulo) <> ''),
  CONSTRAINT chk_bd_pops_categoria_nao_vazia
    CHECK (categoria IS NULL OR btrim(categoria) <> ''),
  CONSTRAINT chk_bd_pops_versao_major CHECK (versao_major >= 1),
  CONSTRAINT chk_bd_pops_versao_minor CHECK (versao_minor >= 0),
  CONSTRAINT chk_bd_pops_mime
    CHECK (arquivo_mime_type IS NULL OR arquivo_mime_type = 'application/pdf'),
  CONSTRAINT chk_bd_pops_tamanho
    CHECK (arquivo_tamanho_bytes IS NULL
           OR arquivo_tamanho_bytes BETWEEN 1 AND 20971520),
  CONSTRAINT chk_bd_pops_nome_original
    CHECK (arquivo_nome_original IS NULL
           OR (char_length(btrim(arquivo_nome_original)) BETWEEN 1 AND 255
               AND arquivo_nome_original !~ '[[:cntrl:]]')),
  CONSTRAINT chk_bd_pops_sha256_formato
    CHECK (arquivo_sha256 IS NULL OR arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_bd_pops_elaborador_coerente
    CHECK (
      (elaborado_por_id IS NULL AND elaborado_por_nome_snapshot IS NULL)
      OR (
        elaborado_por_id IS NOT NULL
        AND elaborado_por_nome_snapshot IS NOT NULL
        AND btrim(elaborado_por_nome_snapshot) <> ''
      )
    ),
  CONSTRAINT chk_bd_pops_arquivo_coerente
    CHECK (
      (arquivo_path IS NULL AND arquivo_sha256 IS NULL
       AND arquivo_mime_type IS NULL AND arquivo_tamanho_bytes IS NULL
       AND arquivo_nome_original IS NULL)
      OR (arquivo_path IS NOT NULL AND arquivo_sha256 IS NOT NULL
          AND arquivo_mime_type IS NOT NULL AND arquivo_tamanho_bytes IS NOT NULL
          AND arquivo_nome_original IS NOT NULL)
    ),
  CONSTRAINT chk_bd_pops_rascunho_sem_publicacao
    CHECK (status <> 'rascunho' OR (
      publicado_em IS NULL
      AND aprovado_por IS NULL
      AND arquivo_path IS NULL
    )),
  CONSTRAINT chk_bd_pops_publicado_completo
    CHECK (status NOT IN ('ativo','obsoleto') OR (
      publicado_em IS NOT NULL
      AND aprovado_por IS NOT NULL
      AND arquivo_path IS NOT NULL
      AND elaborado_por_id IS NOT NULL
      AND elaborado_por_nome_snapshot IS NOT NULL
      AND btrim(elaborado_por_nome_snapshot) <> ''
    )),
  CONSTRAINT chk_bd_pops_obsoleto_coerente
    CHECK (
      (status = 'obsoleto'
        AND obsoleto_em IS NOT NULL
        AND obsoleto_por IS NOT NULL
        AND motivo_obsolescencia IS NOT NULL
        AND btrim(motivo_obsolescencia) <> '')
      OR (status <> 'obsoleto'
        AND obsoleto_em IS NULL
        AND obsoleto_por IS NULL
        AND motivo_obsolescencia IS NULL)
    )
);

CREATE TABLE public.bd_pop_rascunhos (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  pop_id                      uuid NOT NULL,
  codigo                      text NOT NULL,
  titulo                      text NOT NULL,
  setor_id                    uuid NOT NULL,
  categoria                   text NULL,
  tipo_incremento             text NOT NULL,
  motivo_revisao              text NOT NULL,
  arquivo_path                text NULL,
  arquivo_nome_original       text NULL,
  arquivo_mime_type           text NULL,
  arquivo_tamanho_bytes       bigint NULL,
  arquivo_sha256              text NULL,
  elaborado_por_id            uuid NOT NULL,
  elaborado_por_nome_snapshot text NOT NULL,
  criado_por                  uuid NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_bd_pop_rascunhos PRIMARY KEY (id),
  CONSTRAINT uq_bd_pop_rascunhos_pop UNIQUE (pop_id),
  CONSTRAINT fk_bd_pop_rascunhos_pop FOREIGN KEY (pop_id)
    REFERENCES public.bd_pops (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bd_pop_rascunhos_setor FOREIGN KEY (setor_id)
    REFERENCES public.bd_departamentos (id) ON DELETE RESTRICT,
  CONSTRAINT chk_bd_pop_rascunhos_tipo_incremento
    CHECK (tipo_incremento IN ('initial','minor','major')),
  CONSTRAINT chk_bd_pop_rascunhos_codigo_nao_vazio CHECK (btrim(codigo) <> ''),
  CONSTRAINT chk_bd_pop_rascunhos_titulo_nao_vazio CHECK (btrim(titulo) <> ''),
  CONSTRAINT chk_bd_pop_rascunhos_categoria_nao_vazia
    CHECK (categoria IS NULL OR btrim(categoria) <> ''),
  CONSTRAINT chk_bd_pop_rascunhos_motivo_nao_vazio
    CHECK (btrim(motivo_revisao) <> ''),
  CONSTRAINT chk_bd_pop_rascunhos_elaborador_nome_nao_vazio
    CHECK (btrim(elaborado_por_nome_snapshot) <> ''),
  CONSTRAINT chk_bd_pop_rascunhos_mime
    CHECK (arquivo_mime_type IS NULL OR arquivo_mime_type = 'application/pdf'),
  CONSTRAINT chk_bd_pop_rascunhos_tamanho
    CHECK (arquivo_tamanho_bytes IS NULL
           OR arquivo_tamanho_bytes BETWEEN 1 AND 20971520),
  CONSTRAINT chk_bd_pop_rascunhos_nome_original
    CHECK (arquivo_nome_original IS NULL
           OR (char_length(btrim(arquivo_nome_original)) BETWEEN 1 AND 255
               AND arquivo_nome_original !~ '[[:cntrl:]]')),
  CONSTRAINT chk_bd_pop_rascunhos_sha256_formato
    CHECK (arquivo_sha256 IS NULL OR arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_bd_pop_rascunhos_arquivo_coerente
    CHECK (
      (arquivo_path IS NULL AND arquivo_sha256 IS NULL
       AND arquivo_mime_type IS NULL AND arquivo_tamanho_bytes IS NULL
       AND arquivo_nome_original IS NULL)
      OR (arquivo_path IS NOT NULL AND arquivo_sha256 IS NOT NULL
          AND arquivo_mime_type IS NOT NULL AND arquivo_tamanho_bytes IS NOT NULL
          AND arquivo_nome_original IS NOT NULL)
    )
);

CREATE UNIQUE INDEX ux_bd_pops_codigo_normalizado
  ON public.bd_pops (upper(btrim(codigo)));
CREATE INDEX ix_bd_pops_setor  ON public.bd_pops (setor_id);
CREATE INDEX ix_bd_pops_status ON public.bd_pops (status);
CREATE UNIQUE INDEX ux_bd_pops_arquivo_path
  ON public.bd_pops (arquivo_path) WHERE arquivo_path IS NOT NULL;

CREATE INDEX ix_bd_pop_rascunhos_setor ON public.bd_pop_rascunhos (setor_id);
CREATE UNIQUE INDEX ux_bd_pop_rascunhos_arquivo_path
  ON public.bd_pop_rascunhos (arquivo_path) WHERE arquivo_path IS NOT NULL;

ALTER TABLE public.bd_pops          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pop_rascunhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pops          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pop_rascunhos FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bd_pops
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.bd_pop_rascunhos
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.bd_pops          TO authenticated, service_role;
GRANT SELECT ON TABLE public.bd_pop_rascunhos TO authenticated, service_role;

CREATE TRIGGER trg_bd_pops_updated_at
  BEFORE UPDATE ON public.bd_pops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_bd_pop_rascunhos_updated_at
  BEFORE UPDATE ON public.bd_pop_rascunhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE FUNCTION public.fn_pop_bloquear_mutacao_destrutiva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $fn$
BEGIN
  RAISE EXCEPTION 'POP_MUTACAO_DESTRUTIVA_PROIBIDA'
    USING DETAIL = format('TG_OP=%s; TG_TABLE_NAME=%s', TG_OP, TG_TABLE_NAME),
          HINT   = 'POP vigente nao pode ser removido; use a RPC de obsolescencia.';
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_pop_bloquear_mutacao_destrutiva()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_bd_pops_no_delete
  BEFORE DELETE ON public.bd_pops
  FOR EACH ROW EXECUTE FUNCTION public.fn_pop_bloquear_mutacao_destrutiva();

CREATE TRIGGER trg_bd_pops_no_truncate
  BEFORE TRUNCATE ON public.bd_pops
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_pop_bloquear_mutacao_destrutiva();

CREATE TRIGGER trg_bd_pop_rascunhos_no_truncate
  BEFORE TRUNCATE ON public.bd_pop_rascunhos
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_pop_bloquear_mutacao_destrutiva();

INSERT INTO public.bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES
  ('pops_ativo', 'false', 'Habilita o modulo POPs para usuarios finais', true),
  ('pops_homologacao', 'false', 'Habilita o modulo POPs apenas para SuperAdm em homologacao', true);

COMMIT;