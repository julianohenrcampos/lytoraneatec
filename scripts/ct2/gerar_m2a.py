#!/usr/bin/env python3
"""
CT-2 / M2.1 — gerador da migration de correcao dos guards (permission-first).

Le o arquivo fonte da M2 R4, extrai os corpos vivos das 4 RPCs publicas
($b7$..$b10$), aplica exclusivamente os patches de autorizacao aprovados e
emite a migration integral em docs/ct2/.

Nao executa SQL. Nao altera o arquivo fonte. Nao toca nas 6 funcoes internas.
"""
import hashlib
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FONTE = RAIZ / "supabase/migrations/20260728174500_ct2_m2r4_atendimento_rpcs.sql"
SAIDA = RAIZ / "docs/ct2/20260728200000_ct2_m2a_permission_guards.sql"

PERM = "gestao_maquinas_central_transporte_view"

HASHES_PUBLICAS = {
    "fn_ct_atendimento_atribuir": "78b80f993fb73253c72666aa5a758304",
    "fn_ct_atendimento_encerrar": "6c386e2efb798d3b6d6aa390b496e8f2",
    "fn_ct_atendimento_substituir": "208069ee4b9c264929aac4fdf60a49d5",
    "fn_ct_atendimento_listar": "7d5b760d3a414a71dc74f3786590c4b3",
}

HASHES_INTERNAS = {
    "fn_ct_atendimento_json(uuid)": "0d790707051a0d346fec43f89735893b",
    "fn_ct_avaliar_disponibilidade(uuid,text,date)": "91a89bde623538a7a8c65b344798445c",
    "fn_ct_avaliar_match(uuid,uuid)": "f20f2c64c625c581d665efa1d5846d23",
    "fn_ct_contadores_item(uuid)": "f1e9a6f52221d4b97c421d6fa4a4b08e",
    "fn_ct_item_resumo_json(uuid)": "8082882b3bf9fbb3ff2f92e2d0f01413",
    "fn_ct_recalcular_status_item(uuid)": "12ece44549d5fcb0261cd033289cc15a",
}

ASSINATURAS = {
    "fn_ct_atendimento_atribuir": (
        "public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)",
        "p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, "
        "p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, "
        "p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text",
        "jsonb",
        "VOLATILE",
    ),
    "fn_ct_atendimento_encerrar": (
        "public.fn_ct_atendimento_encerrar(uuid,text,text,uuid)",
        "p_atendimento_id uuid, p_novo_status text, p_motivo text, p_request_id uuid",
        "jsonb",
        "VOLATILE",
    ),
    "fn_ct_atendimento_substituir": (
        "public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)",
        "p_atendimento_id uuid, p_novo_equipamento_id uuid, p_modalidade text, "
        "p_motivo text, p_request_id uuid, p_justificativa_override text DEFAULT NULL::text",
        "jsonb",
        "VOLATILE",
    ),
    "fn_ct_atendimento_listar": (
        "public.fn_ct_atendimento_listar(uuid)",
        "p_solicitacao_id uuid",
        "jsonb",
        "STABLE",
    ),
}

TAGS = {
    "fn_ct_atendimento_atribuir": "b7",
    "fn_ct_atendimento_encerrar": "b8",
    "fn_ct_atendimento_substituir": "b9",
    "fn_ct_atendimento_listar": "b10",
}

# ---------------------------------------------------------------- extracao

def extrair(fonte: str, tag: str) -> str:
    abre = f"    'corpo', ${tag}$\n"
    fecha = f"\n${tag}$\n"
    i = fonte.index(abre) + len(abre)
    j = fonte.index(fecha, i)
    return fonte[i:j]


# ---------------------------------------------------------------- patches

PROLOGO_ANTIGO = """  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_NAO_AUTENTICADO' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;
"""

PROLOGO_NOVO = """  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RAISE EXCEPTION 'CT2_PROFILE_NOT_FOUND' USING ERRCODE = 'P0001',
      HINT = 'Perfil de usuario inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
"""

DECL_EXTRA = "  v_sa         boolean;\n  v_apr        boolean;\n"


def gate_antigo(alvo: str) -> str:
    return (
        f"  IF NOT (public.fn_is_super_admin() OR public.fn_ativos_can_access_solicitacao({alvo})) THEN\n"
        "    RAISE EXCEPTION 'CT2_ACESSO_NEGADO' USING ERRCODE = 'P0001',\n"
        "      HINT = 'Voce nao tem acesso a esta solicitacao.';\n"
        "  END IF;\n"
    )


def cap(acao: str, hint: str) -> str:
    return (
        f"    IF NOT public.user_has_permission_action(v_uid, '{PERM}', '{acao}') THEN\n"
        f"      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',\n"
        f"        HINT = '{hint}';\n"
        "    END IF;\n"
    )


def escopo(chamada: str, hint: str) -> str:
    return (
        f"    IF NOT {chamada} THEN\n"
        "      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',\n"
        f"        HINT = '{hint}';\n"
        "    END IF;\n"
    )


GATE_LISTAR = (
    "  IF NOT v_sa THEN\n"
    + cap("visualizar", "Sem permissao para visualizar a Central do Transporte.")
    + escopo(
        "public.fn_ativos_can_access_solicitacao(p_solicitacao_id, v_uid)",
        "Solicitacao fora do seu escopo de acesso.",
    )
    + "  END IF;\n"
)

GATE_ATRIBUIR = (
    "  IF NOT v_sa THEN\n"
    + cap("criar", "Sem permissao para atribuir equipamento na Central do Transporte.")
    + escopo(
        "public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid)",
        "Solicitacao fora do seu escopo de acesso.",
    )
    + escopo(
        "public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid)",
        "Equipamento fora do seu escopo de acesso.",
    )
    + "  END IF;\n"
)

GATE_ENCERRAR = (
    "  IF NOT v_sa THEN\n"
    + cap("editar", "Sem permissao para encerrar atendimento na Central do Transporte.")
    + escopo(
        "public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid)",
        "Solicitacao fora do seu escopo de acesso.",
    )
    + escopo(
        "public.fn_ativos_can_access_equipamento(v_at.equipamento_id, v_uid)",
        "Equipamento fora do seu escopo de acesso.",
    )
    + "  END IF;\n"
)

GATE_SUBSTITUIR = (
    "  IF NOT v_sa THEN\n"
    + cap("criar", "Sem permissao para substituir atendimento na Central do Transporte.")
    + cap("editar", "Sem permissao para substituir atendimento na Central do Transporte.")
    + escopo(
        "public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid)",
        "Solicitacao fora do seu escopo de acesso.",
    )
    + escopo(
        "public.fn_ativos_can_access_equipamento(v_equip0, v_uid)",
        "Equipamento anterior fora do seu escopo de acesso.",
    )
    + escopo(
        "public.fn_ativos_can_access_equipamento(p_novo_equipamento_id, v_uid)",
        "Equipamento novo fora do seu escopo de acesso.",
    )
    + "  END IF;\n"
)


def gates_aprovacao(cond_periodo: str) -> str:
    return (
        f"  v_apr := v_sa OR public.user_has_permission_action(v_uid, '{PERM}', 'aprovar');\n"
        "\n"
        "  IF v_match->>'tipo' = 'PARCIAL' AND NOT v_apr THEN\n"
        "    RAISE EXCEPTION 'CT2_MATCH_PARCIAL_BLOQUEADO' USING ERRCODE = 'P0001',\n"
        "      HINT = 'Match PARCIAL exige permissao de aprovacao.';\n"
        "  END IF;\n"
        "\n"
        f"  IF {cond_periodo} AND NOT v_apr THEN\n"
        "    RAISE EXCEPTION 'CT2_PERIODO_FORA_JANELA' USING ERRCODE = 'P0001',\n"
        "      HINT = 'Periodo fora da janela aprovada exige permissao de aprovacao.';\n"
        "  END IF;\n"
        "\n"
        "  IF v_ovr_disp AND NOT v_apr THEN\n"
        "    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_BLOQUEADA' USING ERRCODE = 'P0001',\n"
        "      HINT = 'Override de disponibilidade exige permissao de aprovacao.';\n"
        "  END IF;\n"
        "\n"
    )


ANCORA_JUST_ATRIBUIR = "  IF (v_match->>'tipo' = 'PARCIAL' OR v_ovr_per OR v_ovr_disp)\n"
ANCORA_JUST_SUBST = "  IF (v_match->>'tipo' = 'PARCIAL' OR v_ant.override_periodo OR v_ovr_disp)\n"


def troca_unica(corpo: str, antigo: str, novo: str, rotulo: str) -> str:
    if corpo.count(antigo) != 1:
        raise SystemExit(f"PATCH ABORTADO: ancora nao unica em {rotulo} ({corpo.count(antigo)}x)")
    return corpo.replace(antigo, novo, 1)


def patch(nome: str, corpo: str) -> str:
    corpo = troca_unica(corpo, "DECLARE\n", "DECLARE\n" + DECL_EXTRA, f"{nome}/DECLARE")
    corpo = troca_unica(corpo, PROLOGO_ANTIGO, PROLOGO_NOVO, f"{nome}/prologo")

    if nome == "fn_ct_atendimento_listar":
        corpo = troca_unica(corpo, gate_antigo("p_solicitacao_id"), GATE_LISTAR, f"{nome}/gate")
    elif nome == "fn_ct_atendimento_atribuir":
        corpo = troca_unica(corpo, gate_antigo("v_sol.id"), GATE_ATRIBUIR, f"{nome}/gate")
        corpo = troca_unica(
            corpo,
            ANCORA_JUST_ATRIBUIR,
            gates_aprovacao("v_ovr_per") + ANCORA_JUST_ATRIBUIR,
            f"{nome}/aprovacao",
        )
    elif nome == "fn_ct_atendimento_encerrar":
        corpo = troca_unica(corpo, gate_antigo("v_sol.id"), GATE_ENCERRAR, f"{nome}/gate")
    elif nome == "fn_ct_atendimento_substituir":
        corpo = troca_unica(corpo, gate_antigo("v_sol.id"), GATE_SUBSTITUIR, f"{nome}/gate")
        corpo = troca_unica(
            corpo,
            ANCORA_JUST_SUBST,
            gates_aprovacao("v_ant.override_periodo") + ANCORA_JUST_SUBST,
            f"{nome}/aprovacao",
        )
    else:
        raise SystemExit(f"funcao inesperada: {nome}")
    return corpo


# ---------------------------------------------------------------- emissao

CAB = """-- =====================================================================
-- CT-2 / M2.1 — CORRECAO DOS GUARDS DAS 4 RPCs PUBLICAS (permission-first)
-- =====================================================================
-- Versao alvo........: CT2_M2A
-- Estado de origem...: CT2_M2_R4 (4 publicas + 6 internas aplicadas)
-- Escopo.............: SOMENTE as 4 funcoes publicas.
--                      As 6 internas NAO sao alteradas (hash verificado).
-- Efeito intencional.: enquanto a permission
--                      gestao_maquinas_central_transporte_view nao existir,
--                      SuperAdm continua autorizado e todos os demais
--                      usuarios recebem CT2_FORBIDDEN.
--                      Apos a M3, os grants passam a produzir efeito.
-- Nao altera: assinaturas, nomes de parametros, defaults, retorno, owner,
--             SECURITY DEFINER, search_path, volatilidade, ACL, transicoes
--             de status, recalculo, locks, idempotencia.
-- =====================================================================

BEGIN;

SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '15s';

-- ---------------------------------------------------------------------
-- PREFLIGHT BLOQUEANTE — estado de origem integral
-- ---------------------------------------------------------------------
DO $preflight$
DECLARE
  v_esperado jsonb := $j${ESPERADO}$j$;
  v_f        jsonb;
  v_oid      oid;
  v_acl      text;
BEGIN
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_esperado)
  LOOP
    v_oid := to_regprocedure(v_f->>'assinatura');
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: funcao ausente %', v_f->>'assinatura';
    END IF;

    PERFORM 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.oid = v_oid
       AND n.nspname = 'public'
       AND md5(p.prosrc) = (v_f->>'body_md5')
       AND pg_get_function_arguments(p.oid) = (v_f->>'args')
       AND pg_get_function_result(p.oid) = (v_f->>'ret')
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prosecdef
       AND p.proconfig @> ARRAY['search_path=public']
       AND p.provolatile = (v_f->>'vol');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: estado divergente em % (hash/args/ret/owner/secdef/search_path/volatilidade)',
        v_f->>'assinatura';
    END IF;

    IF coalesce(obj_description(v_oid, 'pg_proc'), '') NOT LIKE 'CT2_M2_R4%' THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: COMMENT fora da versao CT2_M2_R4 em %', v_f->>'assinatura';
    END IF;

    IF (v_f->>'publica')::boolean THEN
      SELECT coalesce(array_to_string(p.proacl::text[], '|'), '') INTO v_acl
        FROM pg_proc p WHERE p.oid = v_oid;
      IF v_acl <> 'postgres=X/postgres|authenticated=X/postgres' THEN
        RAISE EXCEPTION 'CT2_M2A_DRIFT: ACL divergente em % -> %', v_f->>'assinatura', v_acl;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'CT2_M2A preflight OK: 4 publicas + 6 internas conformes.';
END;
$preflight$;
"""

RODAPE = """
-- ---------------------------------------------------------------------
-- POSTFLIGHT — assinatura, metadados, ACL, COMMENT e integridade interna
-- ---------------------------------------------------------------------
DO $postflight$
DECLARE
  v_pub  jsonb := $j${PUBLICAS}$j$;
  v_int  jsonb := $j${INTERNAS}$j$;
  v_f    jsonb;
  v_oid  oid;
  v_acl  text;
  v_md5  text;
BEGIN
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_pub)
  LOOP
    v_oid := to_regprocedure(v_f->>'assinatura');
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: funcao ausente %', v_f->>'assinatura';
    END IF;

    PERFORM 1 FROM pg_proc p
     WHERE p.oid = v_oid
       AND pg_get_function_arguments(p.oid) = (v_f->>'args')
       AND pg_get_function_result(p.oid) = (v_f->>'ret')
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prosecdef
       AND p.proconfig @> ARRAY['search_path=public']
       AND p.provolatile = (v_f->>'vol');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: contrato divergente em %', v_f->>'assinatura';
    END IF;

    SELECT coalesce(array_to_string(p.proacl::text[], '|'), ''), md5(p.prosrc)
      INTO v_acl, v_md5
      FROM pg_proc p WHERE p.oid = v_oid;

    IF v_acl <> 'postgres=X/postgres|authenticated=X/postgres' THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: ACL divergente em % -> %', v_f->>'assinatura', v_acl;
    END IF;

    IF v_md5 = (v_f->>'body_md5_origem') THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: corpo nao foi alterado em %', v_f->>'assinatura';
    END IF;

    EXECUTE format('COMMENT ON FUNCTION %s IS %L', v_f->>'assinatura',
                   'CT2_M2A body_md5=' || v_md5);

    IF position('user_has_permission_action' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = v_oid)) = 0
       OR position('CT2_FORBIDDEN' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = v_oid)) = 0
       OR position('CT2_SCOPE_DENIED' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = v_oid)) = 0 THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: guards permission-first ausentes em %', v_f->>'assinatura';
    END IF;
  END LOOP;

  -- as 6 internas devem permanecer byte a byte identicas
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_int)
  LOOP
    v_oid := to_regprocedure('public.' || (v_f->>'assinatura'));
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: interna ausente %', v_f->>'assinatura';
    END IF;
    SELECT md5(p.prosrc), coalesce(array_to_string(p.proacl::text[], '|'), '')
      INTO v_md5, v_acl FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> (v_f->>'body_md5') THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: interna alterada % (% <> %)',
        v_f->>'assinatura', v_md5, v_f->>'body_md5';
    END IF;
    IF v_acl <> 'postgres=X/postgres' THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: ACL de interna divergente % -> %', v_f->>'assinatura', v_acl;
    END IF;
  END LOOP;

  RAISE NOTICE 'CT2_M2A postflight OK: 4 publicas endurecidas, 6 internas intactas.';
END;
$postflight$;

COMMIT;
"""


def render_funcao(nome: str, corpo: str) -> str:
    assinatura, args, ret, vol = ASSINATURAS[nome]
    return (
        "\n-- ---------------------------------------------------------------------\n"
        f"-- {nome} — guard permission-first\n"
        "-- ---------------------------------------------------------------------\n"
        f"CREATE OR REPLACE FUNCTION public.{nome}({args})\n"
        f"RETURNS {ret}\n"
        f"LANGUAGE plpgsql\n"
        f"{vol}\n"
        "SECURITY DEFINER\n"
        "SET search_path = public\n"
        "AS $fn$\n"
        f"{corpo}\n"
        "$fn$;\n"
        "\n"
        f"ALTER FUNCTION {assinatura} OWNER TO postgres;\n"
        f"REVOKE ALL ON FUNCTION {assinatura} FROM PUBLIC;\n"
        f"REVOKE ALL ON FUNCTION {assinatura} FROM anon;\n"
        f"GRANT EXECUTE ON FUNCTION {assinatura} TO authenticated;\n"
    )


def main() -> None:
    fonte = FONTE.read_text(encoding="utf-8")

    esperado = []
    for nome, tag in TAGS.items():
        assinatura, args, ret, vol = ASSINATURAS[nome]
        esperado.append(
            {
                "assinatura": assinatura,
                "args": args,
                "ret": ret,
                "vol": "v" if vol == "VOLATILE" else "s",
                "body_md5": HASHES_PUBLICAS[nome],
                "publica": True,
            }
        )
    for assinatura, h in HASHES_INTERNAS.items():
        esperado.append(
            {"assinatura": "public." + assinatura, "body_md5": h, "publica": False,
             "args": None, "ret": None, "vol": None}
        )

    import json

    # preflight so valida contrato completo nas publicas; nas internas, hash.
    esperado_pre = [e for e in esperado if e["publica"]]
    esperado_int = [
        {"assinatura": a, "body_md5": h} for a, h in HASHES_INTERNAS.items()
    ]

    partes = [
        CAB.replace("{ESPERADO}", json.dumps(esperado_pre, ensure_ascii=False, indent=2))
    ]

    # bloco extra de preflight das internas (hash)
    partes.append(
        "\nDO $preflight_int$\nDECLARE\n  v_int jsonb := $j$"
        + json.dumps(esperado_int, ensure_ascii=False, indent=2)
        + "$j$;\n  v_f jsonb;\n  v_oid oid;\n  v_md5 text;\nBEGIN\n"
        "  FOR v_f IN SELECT * FROM jsonb_array_elements(v_int) LOOP\n"
        "    v_oid := to_regprocedure('public.' || (v_f->>'assinatura'));\n"
        "    IF v_oid IS NULL THEN\n"
        "      RAISE EXCEPTION 'CT2_M2A_DRIFT: interna ausente %', v_f->>'assinatura';\n"
        "    END IF;\n"
        "    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p WHERE p.oid = v_oid;\n"
        "    IF v_md5 <> (v_f->>'body_md5') THEN\n"
        "      RAISE EXCEPTION 'CT2_M2A_DRIFT: interna divergente % (% <> %)',\n"
        "        v_f->>'assinatura', v_md5, v_f->>'body_md5';\n"
        "    END IF;\n"
        "  END LOOP;\n"
        "END;\n$preflight_int$;\n"
    )

    for nome in [
        "fn_ct_atendimento_listar",
        "fn_ct_atendimento_atribuir",
        "fn_ct_atendimento_encerrar",
        "fn_ct_atendimento_substituir",
    ]:
        corpo_vivo = extrair(fonte, TAGS[nome])
        if "$fn$" in corpo_vivo:
            raise SystemExit(f"colisao de dollar-quote em {nome}")
        corpo_novo = patch(nome, corpo_vivo)
        partes.append(render_funcao(nome, corpo_novo))

    pub_post = []
    for nome in TAGS:
        assinatura, args, ret, vol = ASSINATURAS[nome]
        pub_post.append(
            {
                "assinatura": assinatura,
                "args": args,
                "ret": ret,
                "vol": "v" if vol == "VOLATILE" else "s",
                "body_md5_origem": HASHES_PUBLICAS[nome],
            }
        )

    partes.append(
        RODAPE.replace("{PUBLICAS}", json.dumps(pub_post, ensure_ascii=False, indent=2))
        .replace("{INTERNAS}", json.dumps(esperado_int, ensure_ascii=False, indent=2))
    )

    sql = "".join(partes)
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(sql, encoding="utf-8")

    print(f"gerado: {SAIDA.relative_to(RAIZ)}")
    print(f"bytes : {len(sql.encode('utf-8'))}")
    print(f"linhas: {sql.count(chr(10))}")
    print(f"sha256: {hashlib.sha256(sql.encode('utf-8')).hexdigest()}")


if __name__ == "__main__":
    main()
