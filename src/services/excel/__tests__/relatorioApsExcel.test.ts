import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  gerarRelatorioApsExcel,
  montarWorkbookRelatorioAps,
  dataIsoParaDateLocal,
} from "../relatorioApsExcel";
import {
  traduzirAtividadeParaTipoAplicacao,
  deduzirTipoAplicacaoDoGrupo,
} from "../relatorio-aps/traduzirAtividade";
import {
  LARGURAS_COLUNAS,
  LINHA_CABECALHO_TABELA,
  LINHA_TITULO_TABELA,
  PRIMEIRA_LINHA_DADOS,
} from "../relatorio-aps/geometria";
import type { RelatorioApsLinha, RelatorioApsState } from "@/types/relatorioAps";

function linha(over: Partial<RelatorioApsLinha> = {}): RelatorioApsLinha {
  return {
    id: over.id ?? "d1",
    sequencia: 1,
    logradouro: "RUA MORA",
    data: "2026-04-08",
    trecho: "Área 01",
    situacao: "CONCLUÍDO",
    comprimento: 45.74,
    larguraMedia: 5.48,
    areaAplicada: 250.66,
    espessura: 5,
    pesoKgM2: 2.4,
    totalKg: 12000,
    tipoAplicacao: "PAVIMENTAÇÃO MECANIZADA",
    ...over,
  };
}

function state(linhas: RelatorioApsLinha[]): RelatorioApsState {
  return {
    registroId: null,
    carregando: false,
    erro: null,
    cabecalho: {
      obra: "Obra X",
      empresa: "Empresa",
      cliente: "Cliente",
      rua: "R.",
      bairro: "B",
      revisao: "R1",
      observacoes: "obs",
      pesoEspecificoPadrao: 2.4,
    },
    linhas,
    fotosDisponiveis: [],
    fotosSelecionadas: [],
    mapa: {
      pontosServico: [],
      pontosRua: [],
      marcadoresManuais: [],
      incluirPontosRuaNoPdf: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

async function abrir(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf as ArrayBuffer);
  return wb2;
}

// Percorre todas as células com valor não-nulo.
function forEachCell(
  ws: ExcelJS.Worksheet,
  fn: (addr: string, value: unknown) => void,
): void {
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      fn(cell.address, cell.value);
    });
  });
}

function coletarFormulas(ws: ExcelJS.Worksheet): Array<{ addr: string; formula: string; result: unknown }> {
  const out: Array<{ addr: string; formula: string; result: unknown }> = [];
  forEachCell(ws, (addr, value) => {
    if (value && typeof value === "object" && "formula" in (value as object)) {
      const v = value as { formula: string; result?: unknown };
      out.push({ addr, formula: v.formula, result: v.result });
    }
  });
  return out;
}

describe("relatorioApsExcel — contrato", () => {
  it("exige centroCustoCodigo não vazio", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gerarRelatorioApsExcel({ state: state([linha()]), centroCustoCodigo: "" } as any),
    ).rejects.toThrow(/Centro de Custo/);
  });
  it("exige linhas montadas", async () => {
    await expect(
      gerarRelatorioApsExcel({ state: state([]), centroCustoCodigo: "L506" }),
    ).rejects.toThrow(/Monte o relatório/);
  });
});

describe("traduzirAtividade", () => {
  it("mapeia pavimentacao_mecanizada", () => {
    expect(traduzirAtividadeParaTipoAplicacao("pavimentacao_mecanizada")).toBe(
      "PAVIMENTAÇÃO MECANIZADA",
    );
  });
  it("tapa_buraco → TAPA-BURACO (nunca RECAPEAMENTO MANUAL)", () => {
    const t = traduzirAtividadeParaTipoAplicacao("tapa_buraco");
    expect(t).toBe("TAPA-BURACO");
    expect(t).not.toContain("RECAPEAMENTO");
  });
  it("grupo misto vira APLICAÇÃO MISTA", () => {
    expect(
      deduzirTipoAplicacaoDoGrupo(["pavimentacao_mecanizada", "tapa_buraco"]),
    ).toBe("APLICAÇÃO MISTA");
  });
});

describe("dataIsoParaDateLocal", () => {
  it("Date local sem fuso", () => {
    const d = dataIsoParaDateLocal("2026-04-08")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(8);
  });
  it("null vira null", () => {
    expect(dataIsoParaDateLocal(null)).toBeNull();
  });
});

describe("relatorioApsExcel — estrutura do workbook (reabre com ExcelJS)", () => {
  it("uma única aba sem apóstrofo, larguras A:R exatas", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    expect(wb.worksheets.length).toBe(1);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe("RELATORIO APS");
    expect(ws.name).not.toContain("'");
    for (const [col, w] of Object.entries(LARGURAS_COLUNAS)) {
      expect(ws.getColumn(col).width).toBeCloseTo(w, 3);
    }
  });

  it("cabeçalho institucional e Centro de Custo presentes", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    expect(ws.getCell("B1").value).toBe("CONSTRUTORA LYTORÂNEA S/A");
    expect(ws.getCell("N1").value).toBe("CENTRO DE CUSTO");
    expect(ws.getCell("O1").value).toBe("L506");
  });

  it("bloco Dados do Relatório NÃO existe em lugar nenhum", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    const proibidos = ["Obra", "Empresa", "Cliente", "Bairro", "Revisão", "Observações"];
    forEachCell(ws, (_addr, value) => {
      const txt =
        typeof value === "string"
          ? value
          : (value && typeof value === "object" && "richText" in (value as object))
          ? ""
          : "";
      for (const p of proibidos) {
        expect(txt).not.toBe(p);
      }
    });
  });

  it("título da tabela na LINHA_TITULO_TABELA", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    expect(ws.getCell(`B${LINHA_TITULO_TABELA}`).value).toBe(
      "REGISTRO DE APLICAÇÃO POR TRECHO",
    );
  });

  it("cabeçalho da tabela em B:R com ATIVIDADE em D e R null", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    const r = LINHA_CABECALHO_TABELA;
    expect(ws.getCell(`B${r}`).value).toBe("LOGRADOURO");
    expect(ws.getCell(`C${r}`).value).toBe("SITUAÇÃO");
    expect(ws.getCell(`D${r}`).value).toBe("ATIVIDADE");
    expect(ws.getCell(`E${r}`).value).toBe("DATA");
    expect(ws.getCell(`Q${r}`).value).toBe("TOTAL");
    expect(ws.getCell(`R${r}`).value ?? null).toBeNull();
  });

  it("K e Q das linhas são números (sem fórmula)", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha({ areaAplicada: 250.66, totalKg: 12000 })]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    const rowDet = PRIMEIRA_LINHA_DADOS + 1;
    const k = ws.getCell(`K${rowDet}`);
    const q = ws.getCell(`Q${rowDet}`);
    expect(typeof k.value).toBe("number");
    expect(typeof q.value).toBe("number");
    expect(k.value).toBeCloseTo(250.66, 6);
    expect(q.value).toBeCloseTo(12, 6);
  });

  it("ATIVIDADE aparece em cada linha com valores esperados", async () => {
    const linhas = [
      linha({ id: "a", logradouro: "RUA A", tipoAplicacao: "TAPA-BURACO" }),
      linha({ id: "b", logradouro: "RUA B", tipoAplicacao: "PAVIMENTAÇÃO MECANIZADA" }),
      linha({ id: "c", logradouro: "RUA C", tipoAplicacao: "FRESAGEM" }),
    ];
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state(linhas),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    // Grupos: faixa 5, det 6 | faixa 7, det 8 | faixa 9, det 10
    expect(ws.getCell("D6").value).toBe("TAPA-BURACO");
    expect(ws.getCell("D8").value).toBe("PAVIMENTAÇÃO MECANIZADA");
    expect(ws.getCell("D10").value).toBe("FRESAGEM");
  });

  it("tipoAplicacao vazio → ATIVIDADE fallback", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha({ tipoAplicacao: null })]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    const v = String(ws.getCell(`D${PRIMEIRA_LINHA_DADOS + 1}`).value);
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toBe(""); // fallback humanizado
  });

  it("espessura via espessuraExibicaoM (5 cm → 0.050 em M)", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha({ espessura: 5 })]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    expect(ws.getCell(`M${PRIMEIRA_LINHA_DADOS + 1}`).value).toBeCloseTo(0.05, 6);
  });

  it("subtotais em K/Q; total geral soma APENAS as células de subtotal", async () => {
    const l1 = linha({ id: "a", logradouro: "RUA A", areaAplicada: 100, totalKg: 5000 });
    const l2 = linha({ id: "b", logradouro: "RUA A", areaAplicada: 200, totalKg: 7000 });
    const l3 = linha({ id: "c", logradouro: "RUA B", areaAplicada: 50, totalKg: 3000 });
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([l1, l2, l3]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    // Grupo1: faixa 5, dets 6-7 | Grupo2: faixa 8, det 9 | Total: 10
    const k1 = ws.getCell("K5").value as { formula: string; result: number };
    const k2 = ws.getCell("K8").value as { formula: string; result: number };
    const kTot = ws.getCell("K10").value as { formula: string; result: number };
    const qTot = ws.getCell("Q10").value as { formula: string; result: number };

    expect(k1.formula).toBe("SUM(K6:K7)");
    expect(k1.result).toBeCloseTo(300, 6);
    expect(k2.formula).toBe("SUM(K9:K9)");
    expect(kTot.formula).toBe("SUM(K5,K8)");
    expect(kTot.formula).not.toContain(":");
    expect(kTot.result).toBeCloseTo(350, 6);
    expect(qTot.result).toBeCloseTo(15, 6);
  });

  it("NENHUMA fórmula começa com '=' e todas têm result finito", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([
          linha({ id: "a", logradouro: "RUA A" }),
          linha({ id: "b", logradouro: "RUA B" }),
        ]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    const formulas = coletarFormulas(ws);
    expect(formulas.length).toBeGreaterThan(0);
    for (const f of formulas) {
      expect(String(f.formula).startsWith("=")).toBe(false);
      expect(Number.isFinite(f.result as number)).toBe(true);
    }
  });

  it("R das linhas e faixas contém 't'", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    expect(ws.getCell(`R${PRIMEIRA_LINHA_DADOS}`).value).toBe("t"); // faixa
    expect(ws.getCell(`R${PRIMEIRA_LINHA_DADOS + 1}`).value).toBe("t"); // detalhe
  });

  it("data como Date com numFmt dd/mm/yyyy", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha({ data: "2026-04-08" })]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    const d = ws.getCell(`E${PRIMEIRA_LINHA_DADOS + 1}`);
    expect(d.value).toBeInstanceOf(Date);
    expect(d.numFmt).toBe("dd/mm/yyyy");
  });

  it("printArea termina em R e printTitlesRow aponta para cabeçalho", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha()]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    expect(ws.pageSetup.orientation).toBe("landscape");
    expect(ws.pageSetup.fitToWidth).toBe(1);
    expect(ws.pageSetup.printTitlesRow).toBe(
      `${LINHA_CABECALHO_TABELA}:${LINHA_CABECALHO_TABELA}`,
    );
    expect(ws.pageSetup.printArea).toMatch(/A1:R\d+/);
  });

  it("coluna A permanece vazia em todas as linhas", async () => {
    const wb = await abrir(
      await montarWorkbookRelatorioAps({
        state: state([linha(), linha({ id: "b" })]),
        centroCustoCodigo: "L506",
      }),
    );
    const ws = wb.worksheets[0];
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      const v = row.getCell("A").value;
      expect(v == null || v === "").toBe(true);
      void rowNum;
    });
  });

  it("arquivo com 1 linha abre; com 2 grupos abre; com 137 linhas abre", async () => {
    for (const n of [1, 2, 137]) {
      const linhas: RelatorioApsLinha[] = [];
      for (let i = 0; i < n; i++) {
        linhas.push(
          linha({ id: `x${i}`, logradouro: `RUA ${i % 3}` }),
        );
      }
      const wb = await abrir(
        await montarWorkbookRelatorioAps({
          state: state(linhas),
          centroCustoCodigo: "L506",
        }),
      );
      expect(wb.worksheets[0].name).toBe("RELATORIO APS");
    }
  });
});
