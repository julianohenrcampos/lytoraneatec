// Fase 6I.2-C — Testes do consolidador de recursos NÃO mão-de-obra.
import { describe, it, expect } from "vitest";
import {
  consolidarRecursosNaoMaoObra,
  familiaParaTipoRecurso,
  type AtividadeRef,
} from "../consolidarRecursosNaoMaoObra";
import type { AlocacaoPreview, FamiliaRecurso } from "../tipos";

function aloc(over: Partial<AlocacaoPreview>): AlocacaoPreview {
  return {
    linhaOriginal: 2,
    uidTarefa: "UT-1",
    idTarefa: "1",
    wbsTarefa: "1.1",
    nomeTarefa: "Atividade X",
    uidRecurso: "UR-1",
    idRecurso: "10",
    nomeRecurso: "ESCAVADEIRA HIDRÁULICA",
    grupoBruto: "INSUMOS",
    grupo: "INSUMOS",
    familiaBruta: "EQ",
    familiaDeclarada: "EQ" as FamiliaRecurso,
    familiaEfetiva: "EQ" as FamiliaRecurso,
    familia: "EQ" as FamiliaRecurso,
    divergenciaFamilia: false,
    natureza: "operacional",
    trabalhoHoras: 40,
    unidades: 1,
    vinculoAtividadeLinha: 2,
    ambiguo: false,
    funcaoId: null,
    funcaoNomeResolvido: null,
    motivoIgnorado: null,
    ...over,
  };
}

const refAtiv: AtividadeRef = {
  id: "ativ-uuid-1",
  data_inicio: "2026-07-13",
  data_fim: "2026-07-17",
  uidTarefa: "UT-1",
};
const mapAtiv = new Map<number, AtividadeRef>([[2, refAtiv]]);

describe("familiaParaTipoRecurso", () => {
  it("mapeia famílias corretamente", () => {
    expect(familiaParaTipoRecurso("MOD")).toBe("mao_obra");
    expect(familiaParaTipoRecurso("MOI")).toBe("mao_obra");
    expect(familiaParaTipoRecurso("EQ")).toBe("equipamento");
    expect(familiaParaTipoRecurso("MAT")).toBe("material");
    expect(familiaParaTipoRecurso("SUB")).toBe("subempreiteiro");
    expect(familiaParaTipoRecurso("ADM")).toBe("administrativo");
    expect(familiaParaTipoRecurso("ADM_CONTRATUAL")).toBe("administrativo");
    expect(familiaParaTipoRecurso("SE")).toBeNull();
    expect(familiaParaTipoRecurso("desconhecida")).toBeNull();
  });
});

describe("consolidarRecursosNaoMaoObra — EQ", () => {
  it("agrupa EQ por (atividade, recurso_uid)", () => {
    const { rows, pendencias } = consolidarRecursosNaoMaoObra(
      [aloc({}), aloc({ trabalhoHoras: 24 })],
      mapAtiv
    );
    expect(pendencias.eqSemUid.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].tipo_recurso).toBe("equipamento");
    expect(rows[0].grupo).toBe("INSUMOS");
    expect(rows[0].familia).toBe("EQ");
    expect(rows[0].recurso_uid_externo).toBe("UR-1");
    expect(rows[0].atividade_uid_externo).toBe("UT-1");
    expect(rows[0].data_necessaria_inicio).toBe("2026-07-13");
    expect(rows[0].data_necessaria_fim).toBe("2026-07-17");
    expect(rows[0].status_origem).toBe("planejado");
    expect(rows[0].horas_previstas).toBe(64);
  });

  it("EQ sem uidRecurso vai para pendência e NÃO é persistido", () => {
    const { rows, pendencias } = consolidarRecursosNaoMaoObra(
      [aloc({ uidRecurso: null }), aloc({ uidRecurso: "" })],
      mapAtiv
    );
    expect(rows.length).toBe(0);
    expect(pendencias.eqSemUid.length).toBe(2);
    expect(pendencias.eqSemUid[0].atividade_uid_externo).toBe("UT-1");
  });
});

describe("consolidarRecursosNaoMaoObra — MAT", () => {
  it("MAT sem unidade vai para pendência e NÃO é persistido nesta fase", () => {
    const { rows, pendencias } = consolidarRecursosNaoMaoObra(
      [
        aloc({
          familiaEfetiva: "MAT",
          familia: "MAT",
          familiaDeclarada: "MAT",
          familiaBruta: "MAT",
          nomeRecurso: "CIMENTO CP-II",
          uidRecurso: "UR-MAT-1",
        }),
      ],
      mapAtiv
    );
    expect(rows.length).toBe(0);
    expect(pendencias.matSemUnidade.length).toBe(1);
    expect(pendencias.matSemUnidade[0].descricao).toBe("CIMENTO CP-II");
  });
});

describe("consolidarRecursosNaoMaoObra — SUB / ADM", () => {
  it("SUB agrupa por descrição e usa unidade default 'vb'", () => {
    const { rows } = consolidarRecursosNaoMaoObra(
      [
        aloc({
          familiaEfetiva: "SUB",
          familia: "SUB",
          familiaDeclarada: "SUB",
          familiaBruta: "SUB",
          nomeRecurso: "SERVIÇO DE TOPOGRAFIA",
          uidRecurso: "UR-SUB-1",
          trabalhoHoras: 16,
        }),
        aloc({
          familiaEfetiva: "SUB",
          familia: "SUB",
          familiaDeclarada: "SUB",
          familiaBruta: "SUB",
          nomeRecurso: " serviço de topografia ",
          uidRecurso: "UR-SUB-2",
          trabalhoHoras: 8,
        }),
      ],
      mapAtiv
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tipo_recurso).toBe("subempreiteiro");
    expect(rows[0].unidade).toBe("vb");
    expect(rows[0].familia).toBe("SUB");
    expect(rows[0].horas_previstas).toBe(24);
  });

  it("ADM_CONTRATUAL → tipo_recurso=administrativo, preserva familia='ADM_CONTRATUAL'", () => {
    const { rows } = consolidarRecursosNaoMaoObra(
      [
        aloc({
          familiaEfetiva: "ADM_CONTRATUAL",
          familia: "ADM_CONTRATUAL",
          familiaDeclarada: "ADM_CONTRATUAL",
          familiaBruta: "ADM_CONTRATUAL",
          nomeRecurso: "ENCARREGADO ADMINISTRATIVO",
          uidRecurso: "UR-ADM-1",
          trabalhoHoras: 40,
        }),
      ],
      mapAtiv
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tipo_recurso).toBe("administrativo");
    expect(rows[0].familia).toBe("ADM_CONTRATUAL");
    expect(rows[0].unidade).toBe("h");
  });
});

describe("consolidarRecursosNaoMaoObra — anti-FATURAMENTO", () => {
  it("descarta linhas com grupo != INSUMOS", () => {
    const { rows } = consolidarRecursosNaoMaoObra(
      [aloc({ grupo: "FATURAMENTO" })],
      mapAtiv
    );
    expect(rows.length).toBe(0);
  });
});

describe("consolidarRecursosNaoMaoObra — vínculo / motivo ignorado", () => {
  it("ignora alocações com motivoIgnorado != null", () => {
    const { rows } = consolidarRecursosNaoMaoObra(
      [aloc({ motivoIgnorado: "sem_atividade" })],
      mapAtiv
    );
    expect(rows.length).toBe(0);
  });

  it("ignora alocações sem vínculo de atividade", () => {
    const { rows } = consolidarRecursosNaoMaoObra(
      [aloc({ vinculoAtividadeLinha: null })],
      mapAtiv
    );
    expect(rows.length).toBe(0);
  });
});
