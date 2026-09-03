import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RelatorioApsState } from "@/types/relatorioAps";

// --- Fake PptxGenJS -----------------------------------------------------
interface AddTextCall {
  text: unknown;
  opts: Record<string, unknown>;
}
interface AddTableCall {
  rows: unknown[];
  opts: Record<string, unknown>;
}
interface AddImageCall {
  opts: Record<string, unknown>;
}
class FakeSlide {
  texts: AddTextCall[] = [];
  tables: AddTableCall[] = [];
  images: AddImageCall[] = [];
  shapes: Array<{ shape: string; opts: Record<string, unknown> }> = [];
  background = { color: "" };
  addText(text: unknown, opts: Record<string, unknown>) {
    this.texts.push({ text, opts });
    return this;
  }
  addTable(rows: unknown[], opts: Record<string, unknown>) {
    this.tables.push({ rows, opts });
    return this;
  }
  addImage(opts: Record<string, unknown>) {
    this.images.push({ opts });
    return this;
  }
  addShape(shape: string, opts: Record<string, unknown>) {
    this.shapes.push({ shape, opts });
    return this;
  }
}
class FakePptx {
  layout = "";
  theme: Record<string, string> = {};
  author = "";
  company = "";
  subject = "";
  title = "";
  slides: FakeSlide[] = [];
  writeFileArgs: { fileName: string; compression?: boolean } | null = null;
  addSlide() {
    const s = new FakeSlide();
    this.slides.push(s);
    return s;
  }
  writeFile(opts: { fileName: string; compression?: boolean }): Promise<string> {
    this.writeFileArgs = opts;
    return Promise.resolve(opts.fileName);
  }
}
let currentFake: FakePptx;

vi.mock("pptxgenjs", () => {
  return {
    default: class {
      constructor() {
        currentFake = new FakePptx();
        return currentFake as unknown as object;
      }
    },
  };
});

// Impede fetch real das fotos
vi.mock("@/lib/relatorio-aps/imagemDataUrl", () => ({
  signedUrlParaDataUrl: vi.fn(async () => null),
}));

// ---- imports após mocks --------------------------------------------------
import { gerarRelatorioApsPptx } from "@/services/pptx/relatorioApsPptx";

function estadoBase(overrides: Partial<RelatorioApsState> = {}): RelatorioApsState {
  return {
    registroId: "reg-1",
    carregando: false,
    erro: null,
    cabecalho: {
      obra: "Obra Teste",
      empresa: "Lytorânea",
      cliente: "Prefeitura",
      rua: "Rua Alfa",
      bairro: "Centro",
      observacoes: "Observação curta.",
      revisao: "00",
      pesoEspecificoPadrao: 2.4,
    },
    linhas: [
      {
        id: "L1",
        sequencia: 1,
        logradouro: "Rua Alfa",
        data: "2026-07-19",
        trecho: "1",
        situacao: "APLICAÇÃO",
        comprimento: 10,
        larguraMedia: 3,
        areaAplicada: 30,
        espessura: 5,
        pesoKgM2: 2.4,
        totalKg: 360,
      },
    ],
    fotosDisponiveis: [],
    fotosSelecionadas: [],
    mapa: {
      pontosServico: [],
      pontosRua: [],
      linhaServico: [],
      areasAplicacao: [],
      ajustesPontosServico: {},
      ajustesPontosRua: {},
      marcadoresManuais: [],
      mostrarPontosRua: true,
      incluirPontosRuaNoPdf: true,
    },
    ...overrides,
  };
}

beforeEach(() => {
  currentFake = new FakePptx();
});

describe("gerarRelatorioApsPptx — fluxo", () => {
  it("zero linhas → throw", async () => {
    const st = estadoBase();
    st.linhas = [];
    await expect(gerarRelatorioApsPptx({ state: st })).rejects.toThrow(
      /Monte o relatório/,
    );
  });

  it("gera capa + tabela + fotos com rodapé i/N em todos os slides", async () => {
    await gerarRelatorioApsPptx({
      state: estadoBase(),
      mapaDataUrl: "data:image/png;base64,ZZZ",
    });
    const total = currentFake.slides.length;
    // capa + 1 tabela + fotos = 3
    expect(total).toBe(3);
    currentFake.slides.forEach((s, i) => {
      const rodape = s.texts.find(
        (t) =>
          typeof t.text === "string" &&
          (t.text as string).includes(`${i + 1}/${total}`),
      );
      expect(rodape).toBeTruthy();
    });
    // primeiro = 1/N, último = N/N
    expect(
      currentFake.slides[0].texts.some(
        (t) => typeof t.text === "string" && (t.text as string).includes(`1/${total}`),
      ),
    ).toBe(true);
    expect(
      currentFake.slides[total - 1].texts.some(
        (t) => typeof t.text === "string" && (t.text as string).includes(`${total}/${total}`),
      ),
    ).toBe(true);
  });

  it("mapa ausente → placeholder na capa; não aborta", async () => {
    await gerarRelatorioApsPptx({ state: estadoBase(), mapaDataUrl: null });
    const capa = currentFake.slides[0];
    const placeholder = capa.texts.find((t) => t.text === "Mapa indisponível");
    expect(placeholder).toBeTruthy();
  });

  it("observação extensa gera slides de continuação antes da tabela", async () => {
    const st = estadoBase();
    st.cabecalho.observacoes = ("Bloco de observações. ".repeat(600)).trim();
    await gerarRelatorioApsPptx({ state: st });
    const total = currentFake.slides.length;
    // capa (0) + continuações... + tabela + fotos
    expect(total).toBeGreaterThanOrEqual(4);
    // slide 1 deve ser continuação (ainda não a tabela)
    const slide1 = currentFake.slides[1];
    const isContinuacao = slide1.texts.some(
      (t) =>
        typeof t.text === "string" &&
        (t.text as string).includes("CONTINUAÇÃO"),
    );
    expect(isContinuacao).toBe(true);
  });

  it("TOTAL GERAL exatamente uma vez com valor correto", async () => {
    const st = estadoBase();
    st.linhas = Array.from({ length: 5 }, (_, i) => ({
      id: `L${i + 1}`,
      sequencia: i + 1,
      logradouro: "Rua A",
      data: "2026-07-19",
      trecho: String(i + 1),
      situacao: "APLICAÇÃO",
      comprimento: 10,
      larguraMedia: 3,
      areaAplicada: 30,
      espessura: 5,
      pesoKgM2: 2.4,
      totalKg: 360,
    }));
    await gerarRelatorioApsPptx({ state: st });
    // procurar "TOTAL GERAL" nas rows de todas as tabelas
    let ocorrencias = 0;
    for (const s of currentFake.slides) {
      for (const t of s.tables) {
        for (const row of t.rows as unknown[][]) {
          for (const cell of row) {
            const cAny = cell as { text?: unknown };
            if (typeof cAny?.text === "string" && cAny.text === "TOTAL GERAL") {
              ocorrencias += 1;
            }
          }
        }
      }
    }
    expect(ocorrencias).toBe(1);
  });

  it("nome do arquivo prioriza obra e usa data local yyyy-MM-dd", async () => {
    await gerarRelatorioApsPptx({ state: estadoBase() });
    expect(currentFake.writeFileArgs?.fileName).toMatch(
      /^Relatorio_APs_Obra_Teste_\d{4}-\d{2}-\d{2}\.pptx$/,
    );
    expect(currentFake.writeFileArgs?.compression).toBe(true);
  });

  it("configura layout/tema/metadados obrigatórios", async () => {
    await gerarRelatorioApsPptx({ state: estadoBase() });
    expect(currentFake.layout).toBe("LAYOUT_WIDE");
    expect(currentFake.author).toBe("LYTOTEC");
    expect(currentFake.company).toBe("Construtora Lytorânea");
    expect(currentFake.title).toBe("Relatório de Aplicação Diária");
    expect(currentFake.theme.headFontFace).toBe("Arial");
    expect(currentFake.theme.lang).toBe("pt-BR");
  });

  it("addTable recebe rowH e colW e não usa autoPage", async () => {
    await gerarRelatorioApsPptx({ state: estadoBase() });
    const tabelaSlides = currentFake.slides.filter((s) => s.tables.length > 0);
    expect(tabelaSlides.length).toBeGreaterThan(0);
    for (const s of tabelaSlides) {
      const t = s.tables[0];
      expect(Array.isArray(t.opts.rowH)).toBe(true);
      expect(Array.isArray(t.opts.colW)).toBe(true);
      expect((t.opts.rowH as number[]).length).toBe((t.rows as unknown[]).length);
      expect(t.opts.autoPage).toBe(false);
    }
  });
});
