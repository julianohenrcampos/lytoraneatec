/**
 * Rodada "UUID vazio" — o payload da RPC nunca pode carregar string vazia em
 * coluna uuid, e o modo CREATE nunca pode inferir status.
 */
import { describe, expect, it } from "vitest";
import {
  IdentificadorInvalidoError,
  montarArgsDisponibilidadeUpsert,
  diagnosticoSanitizado,
} from "@/services/centralTransporteDisponibilidadeService";
import {
  construirValoresIniciais,
  limparCamposIncompativeis,
  resolverModo,
  validarFormDisponibilidade,
  type ValoresFormDisponibilidade,
} from "@/components/disponibilidade/disponibilidadeFormLogic";
import { estadoParametroUuid, isUuid, uuidOuNull } from "@/utils/uuidOuNull";

const EQUIP = "11111111-1111-4111-8111-111111111111";
const CC = "22222222-2222-4222-8222-222222222222";

const base: ValoresFormDisponibilidade = {
  status: "DISPONIVEL",
  centroCustoId: "",
  dataInicio: "2026-01-05",
  previsaoLiberacao: "",
  confiabilidade: "",
  motivoRisco: "",
  observacao: "",
};

describe("uuidOuNull", () => {
  it("converte vazio e whitespace em null", () => {
    expect(uuidOuNull("")).toBeNull();
    expect(uuidOuNull("   ")).toBeNull();
    expect(uuidOuNull(undefined)).toBeNull();
  });
  it("reconhece apenas UUID canônico", () => {
    expect(isUuid(EQUIP)).toBe(true);
    expect(isUuid("")).toBe(false);
    expect(isUuid("abc")).toBe(false);
  });
  it("classifica o estado do parâmetro para diagnóstico", () => {
    expect(estadoParametroUuid("")).toBe("vazio");
    expect(estadoParametroUuid("abc")).toBe("invalido");
    expect(estadoParametroUuid(CC)).toBe("valido");
  });
});

describe("payload da RPC", () => {
  it("nunca envia string vazia em centro de custo", () => {
    const args = montarArgsDisponibilidadeUpsert({
      modo: "CREATE",
      equipamentoId: EQUIP,
      statusOperacional: "DISPONIVEL",
      centroCustoId: "",
      dataInicio: "2026-01-05",
    });
    expect(args.p_centro_custo_id).toBeNull();
    expect(Object.values(args).some((v) => v === "")).toBe(false);
  });

  it("bloqueia equipamento vazio antes de tocar o banco", () => {
    expect(() =>
      montarArgsDisponibilidadeUpsert({
        modo: "CREATE",
        equipamentoId: "",
        statusOperacional: "DISPONIVEL",
      }),
    ).toThrow(IdentificadorInvalidoError);
  });

  it("rejeita centro de custo não-UUID em vez de silenciar como null", () => {
    expect(() =>
      montarArgsDisponibilidadeUpsert({
        modo: "EDIT",
        equipamentoId: EQUIP,
        statusOperacional: "ALOCADO",
        centroCustoId: "obra-x",
      }),
    ).toThrow(IdentificadorInvalidoError);
  });

  it("limpa previsão e confiabilidade quando DISPONIVEL", () => {
    const args = montarArgsDisponibilidadeUpsert({
      modo: "EDIT",
      equipamentoId: EQUIP,
      statusOperacional: "DISPONIVEL",
      previsaoLiberacao: "2026-02-01",
      confiabilidade: "ALTA",
    });
    expect(args.p_previsao_liberacao).toBeNull();
    expect(args.p_confiabilidade).toBeNull();
  });

  it("o diagnóstico não vaza identificadores", () => {
    const diag = diagnosticoSanitizado({
      modo: "CREATE",
      equipamentoId: EQUIP,
      statusOperacional: "DISPONIVEL",
      centroCustoId: CC,
    });
    expect(JSON.stringify(diag)).not.toContain(EQUIP);
    expect(JSON.stringify(diag)).not.toContain(CC);
  });
});

describe("modo e valores iniciais", () => {
  it("CREATE abre com status nulo (sem inferência de DISPONIVEL)", () => {
    const v = construirValoresIniciais("CREATE", null);
    expect(v.status).toBeNull();
    expect(v.dataInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("EDIT preserva o registro real, inclusive data de início", () => {
    const v = construirValoresIniciais("EDIT", {
      statusOperacional: "ALOCADO",
      centroCustoId: CC,
      dataInicio: "2025-12-01",
      previsaoLiberacao: "2026-03-01",
      confiabilidadePrevisao: "MEDIA",
      motivoRisco: "Obra em curso",
      observacao: null,
    });
    expect(v).toMatchObject({ status: "ALOCADO", centroCustoId: CC, dataInicio: "2025-12-01" });
  });

  it("indicador e registro divergentes não viram CREATE", () => {
    expect(resolverModo(true, null)).toBe("INDETERMINADO");
    expect(resolverModo(false, null)).toBe("CREATE");
  });
});

describe("validação condicional", () => {
  it("exige status", () => {
    expect(validarFormDisponibilidade({ ...base, status: null }, EQUIP).status).toBeTruthy();
  });
  it("ALOCADO exige previsão, confiabilidade e motivo", () => {
    const erros = validarFormDisponibilidade({ ...base, status: "ALOCADO" }, EQUIP);
    expect(erros.previsaoLiberacao && erros.confiabilidade && erros.motivoRisco).toBeTruthy();
  });
  it("MANUTENCAO exige motivo e confiabilidade só quando há previsão", () => {
    const semPrevisao = validarFormDisponibilidade(
      { ...base, status: "MANUTENCAO", motivoRisco: "Bomba" },
      EQUIP,
    );
    expect(semPrevisao).toEqual({});
    const comPrevisao = validarFormDisponibilidade(
      { ...base, status: "MANUTENCAO", motivoRisco: "Bomba", previsaoLiberacao: "2026-02-01" },
      EQUIP,
    );
    expect(comPrevisao.confiabilidade).toBeTruthy();
  });
  it("equipamento inválido bloqueia o submit", () => {
    expect(validarFormDisponibilidade(base, "").status).toBeTruthy();
  });
  it("DISPONIVEL limpa campos incompatíveis antes do envio", () => {
    const limpo = limparCamposIncompativeis({
      ...base,
      previsaoLiberacao: "2026-02-01",
      confiabilidade: "ALTA",
    });
    expect(limpo.previsaoLiberacao).toBe("");
    expect(limpo.confiabilidade).toBe("");
  });
});
