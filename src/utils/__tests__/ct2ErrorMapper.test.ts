/**
 * CT-2 / M4 — Normalização de erros das RPCs.
 * Determinístico libera a tentativa; rede/timeout preserva o request_id.
 */
import { describe, it, expect } from "vitest";
import { extractCt2Code, normalizeCt2Error } from "@/utils/ct2ErrorMapper";

describe("ct2ErrorMapper", () => {
  it("extrai o código CT2 da mensagem do Postgres", () => {
    expect(extractCt2Code({ message: 'erro: CT2_FORBIDDEN ao executar' })).toBe("CT2_FORBIDDEN");
  });

  it("erro CT2 é determinístico (não incerto) e tem mensagem em português", () => {
    const n = normalizeCt2Error({ message: "CT2_EQUIPAMENTO_EM_CONFLITO" });
    expect(n.isUncertain).toBe(false);
    expect(n.code).toBe("CT2_EQUIPAMENTO_EM_CONFLITO");
    expect(n.message).toMatch(/comprometido/i);
  });

  it.each([
    "CT2_FORBIDDEN",
    "CT2_MATCH_PARCIAL_BLOQUEADO",
    "CT2_PERIODO_FORA_JANELA",
    "CT2_JUSTIFICATIVA_OBRIGATORIA",
    "CT2_MOTIVO_OBRIGATORIO",
    "CT2_SUBSTITUICAO_SEM_EFEITO",
    "CT2_ATENDIMENTO_JA_ENCERRADO",
    "CT2_IDEMPOTENCY_KEY_REUSED",
  ])("%s possui mensagem dedicada e é determinístico", (code) => {
    const n = normalizeCt2Error({ message: code });
    expect(n.isUncertain).toBe(false);
    expect(n.message).not.toMatch(/Não foi possível concluir a operação\./);
  });

  it("nenhuma mensagem expõe SQL bruto", () => {
    const n = normalizeCt2Error({
      message: 'CT2_ITEM_NAO_ENCONTRADO',
      details: 'select * from bd_ct_atendimentos where id = $1',
    });
    expect(n.message).not.toMatch(/select|from |bd_ct_/i);
  });

  it("falha de rede é incerta", () => {
    expect(normalizeCt2Error(new Error("Failed to fetch")).isUncertain).toBe(true);
    expect(normalizeCt2Error(new Error("timeout of 30000ms exceeded")).isUncertain).toBe(true);
    expect(normalizeCt2Error(new Error("504 Gateway Timeout")).isUncertain).toBe(true);
  });

  it("erro vazio/desconhecido é tratado como incerto por precaução", () => {
    expect(normalizeCt2Error({}).isUncertain).toBe(true);
    expect(normalizeCt2Error({ message: "algo estranho aconteceu" }).isUncertain).toBe(true);
  });

  it("código desconhecido CT2_* usa fallback genérico mas segue determinístico", () => {
    const n = normalizeCt2Error({ message: "CT2_ALGO_NOVO" });
    expect(n.code).toBe("CT2_ALGO_NOVO");
    expect(n.isUncertain).toBe(false);
    expect(n.message).toContain("CT2_ALGO_NOVO");
    expect(n.message).toContain("nada foi gravado");

  });
});

describe("CT-3D.4 — códigos e SQLSTATE determinísticos", () => {
  it("reconhece códigos CT3D_* como determinísticos", () => {
    const out = normalizeCt2Error({
      code: "P0001",
      message: "CT3D_COORDENADA_INCOMPLETA",
      hint: "Informe latitude e longitude juntas ao ajustar o ponto no mapa.",
    });
    expect(out.code).toBe("CT3D_COORDENADA_INCOMPLETA");
    expect(out.isUncertain).toBe(false);
  });

  it("reconhece códigos CT3_* como determinísticos", () => {
    const out = normalizeCt2Error({ code: "P0001", message: "CT3_IDEMPOTENCY_KEY_REUSED" });
    expect(out.code).toBe("CT3_IDEMPOTENCY_KEY_REUSED");
    expect(out.isUncertain).toBe(false);
  });

  it("trata P0001 sem código de domínio como aborto determinístico", () => {
    const out = normalizeCt2Error({ code: "P0001", message: "algo inesperado", hint: "" });
    expect(out.isUncertain).toBe(false);
    expect(out.code).toBe("P0001");
  });

  it("trata violação de constraint (23514) como determinística", () => {
    const out = normalizeCt2Error({ code: "23514", message: "ck_ct_viagens_coerencia_modalidade" });
    expect(out.isUncertain).toBe(false);
  });

  it("trata estado interno inválido (55000) como aborto determinístico", () => {
    const out = normalizeCt2Error({
      code: "55000",
      message: "record is not assigned yet",
    });
    expect(out.isUncertain).toBe(false);
    expect(out.code).toBe("55000");
    expect(out.message).not.toMatch(/record|sql|postgres/i);
  });
});
