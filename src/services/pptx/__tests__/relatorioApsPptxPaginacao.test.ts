import { describe, it, expect } from "vitest";
import {
  paginarTabelaPptx,
  planejarObservacoesPptx,
} from "@/services/pptx/relatorioApsPptxPaginacao";
import {
  APS_PPTX_CAPACIDADE_PADRAO,
  APS_PPTX_CAPACIDADE_ULTIMA,
  APS_PPTX_TABLE_LAYOUT,
  APS_PPTX_TABLE_USEFUL_H,
} from "@/services/pptx/relatorioApsPptxLayout";
import type { RelatorioApsLinha } from "@/types/relatorioAps";
import type { GrupoLinhas } from "@/lib/relatorio-aps/agrupar";

// ---------- helpers ----------
function linha(id: string, logradouro = "Rua A"): RelatorioApsLinha {
  return {
    id,
    sequencia: Number(id.replace(/\D/g, "")) || 0,
    logradouro,
    data: "2026-07-19",
    trecho: "1",
    situacao: "APLICAÇÃO",
    comprimento: 10,
    larguraMedia: 3,
    areaAplicada: 30,
    espessura: 5,
    pesoKgM2: 2.4,
    totalKg: 360,
  };
}
function grupo(logradouro: string, linhas: RelatorioApsLinha[]): GrupoLinhas {
  return {
    logradouro,
    rotulo: "APLICAÇÃO",
    linhas,
    somaArea: linhas.reduce((a, l) => a + l.areaAplicada, 0),
    somaTotalT: linhas.reduce((a, l) => a + l.totalKg, 0) / 1000,
  };
}

function idsAchatados(slides: ReturnType<typeof paginarTabelaPptx>): string[] {
  const out: string[] = [];
  for (const s of slides) for (const f of s.faixas) for (const l of f.linhas) out.push(l.id);
  return out;
}
function detalhesNoSlide(s: ReturnType<typeof paginarTabelaPptx>[number]) {
  return s.faixas.reduce((acc, f) => acc + f.linhas.length, 0);
}

// ---------- LAYOUT ----------
describe("APS_PPTX_TABLE_LAYOUT", () => {
  it("soma de colW ≈ w (± 0.02)", () => {
    const soma = APS_PPTX_TABLE_LAYOUT.colW.reduce((a, b) => a + b, 0);
    expect(Math.abs(soma - APS_PPTX_TABLE_LAYOUT.w)).toBeLessThan(0.02);
  });
  it("capacidades derivadas correspondem", () => {
    expect(APS_PPTX_CAPACIDADE_PADRAO).toBe(19);
    expect(APS_PPTX_CAPACIDADE_ULTIMA).toBe(18);
  });
  it("fonte inicial mínima da tabela = 8pt", () => {
    expect(APS_PPTX_TABLE_LAYOUT.fontSize).toBe(8);
  });
});

// ---------- PAGINAÇÃO TABELA ----------
describe("paginarTabelaPptx", () => {
  it("2 linhas — 1 slide, último com detalhe + TOTAL cabendo", () => {
    const ls = [linha("L1"), linha("L2")];
    const slides = paginarTabelaPptx([grupo("Rua A", ls)]);
    expect(slides).toHaveLength(1);
    expect(slides[0].ultimaDaTabela).toBe(true);
    expect(detalhesNoSlide(slides[0])).toBe(2);
  });

  it("137 linhas em 1 grupo — múltiplos slides, ordem/IDs íntegros", () => {
    const ls = Array.from({ length: 137 }, (_, i) => linha(`L${i + 1}`));
    const slides = paginarTabelaPptx([grupo("Rua A", ls)]);

    expect(slides.length).toBeGreaterThan(1);
    expect(slides.filter((s) => s.ultimaDaTabela)).toHaveLength(1);
    expect(slides.at(-1)?.ultimaDaTabela).toBe(true);

    const somaDetalhes = slides.reduce((a, s) => a + detalhesNoSlide(s), 0);
    expect(somaDetalhes).toBe(137);

    const ids = idsAchatados(slides);
    expect(ids).toHaveLength(137);
    expect(new Set(ids).size).toBe(137);
    expect(ids).toEqual(ls.map((l) => l.id));

    // último slide deve conter pelo menos 1 detalhe
    expect(detalhesNoSlide(slides.at(-1)!)).toBeGreaterThan(0);
    // nenhum slide apenas com TOTAL
    for (const s of slides) expect(detalhesNoSlide(s)).toBeGreaterThan(0);
  });

  it("grupo maior que capacidade — continuações marcadas e ordem preservada", () => {
    const ls = Array.from({ length: 45 }, (_, i) => linha(`X${i + 1}`));
    const slides = paginarTabelaPptx([grupo("Rua X", ls)]);
    expect(slides.length).toBeGreaterThan(1);
    // primeira faixa do primeiro slide NÃO é continuação
    expect(slides[0].faixas[0].continuacao).toBe(false);
    // demais faixas do mesmo grupo em slides seguintes = continuacao
    for (let i = 1; i < slides.length; i += 1) {
      expect(slides[i].faixas[0].continuacao).toBe(true);
    }
    expect(idsAchatados(slides)).toEqual(ls.map((l) => l.id));
  });

  it("rowH deriva 1:1 do plano (header + faixa + detail + total) e cabe na área útil", () => {
    const ls = Array.from({ length: 137 }, (_, i) => linha(`L${i + 1}`));
    const slides = paginarTabelaPptx([grupo("Rua A", ls)]);
    for (const s of slides) {
      const nRows =
        1 + // header
        s.faixas.length +
        s.faixas.reduce((a, f) => a + f.linhas.length, 0) +
        (s.ultimaDaTabela ? 1 : 0);
      const soma =
        APS_PPTX_TABLE_LAYOUT.headerH +
        s.faixas.length * APS_PPTX_TABLE_LAYOUT.groupH +
        s.faixas.reduce((a, f) => a + f.linhas.length, 0) * APS_PPTX_TABLE_LAYOUT.detailH +
        (s.ultimaDaTabela ? APS_PPTX_TABLE_LAYOUT.totalH : 0);
      expect(soma).toBeLessThanOrEqual(APS_PPTX_TABLE_USEFUL_H + 1e-9);
      expect(nRows).toBeGreaterThan(0);
    }
  });

  it("caso vazio devolve []", () => {
    expect(paginarTabelaPptx([])).toEqual([]);
  });
});

// ---------- OBSERVAÇÕES ----------
describe("planejarObservacoesPptx", () => {
  const opts = { charsCapa: 100, charsContinuacao: 300 };

  it("vazio → placeholder", () => {
    const p = planejarObservacoesPptx("", opts);
    expect(p.textoCapa).toBe("Sem observações finais");
    expect(p.continuacoes).toEqual([]);
    const p2 = planejarObservacoesPptx(null, opts);
    expect(p2.textoCapa).toBe("Sem observações finais");
  });

  it("curta → tudo na capa", () => {
    const txt = "Curta.";
    const p = planejarObservacoesPptx(txt, opts);
    expect(p.textoCapa).toBe(txt);
    expect(p.continuacoes).toEqual([]);
  });

  it("longa com parágrafos → reconstrução exata e sem duplicação", () => {
    const paragrafo = "Palavra ".repeat(30).trim();
    const original = Array.from({ length: 20 }, () => paragrafo).join("\n\n");
    const p = planejarObservacoesPptx(original, opts);
    expect([p.textoCapa, ...p.continuacoes].join("")).toBe(original);
    expect(p.continuacoes.length).toBeGreaterThan(0);
    // não repete conteúdo (todas as fatias são únicas por posição)
    const fatias = [p.textoCapa, ...p.continuacoes];
    const soma = fatias.reduce((a, s) => a + s.length, 0);
    expect(soma).toBe(original.length);
  });

  it("texto sem separadores (uma única palavra gigante) — hard cut apenas quando necessário", () => {
    const original = "A".repeat(500);
    const p = planejarObservacoesPptx(original, opts);
    expect([p.textoCapa, ...p.continuacoes].join("")).toBe(original);
  });

  it("nunca corta palavra quando existe espaço anterior", () => {
    const original =
      "abcdefghij ".repeat(50).trim(); // 549 chars, muitos espaços
    const p = planejarObservacoesPptx(original, { charsCapa: 50, charsContinuacao: 60 });
    expect([p.textoCapa, ...p.continuacoes].join("")).toBe(original);
    // cada fatia (exceto a última) termina em espaço, provando quebra no separador
    for (let i = 0; i < p.continuacoes.length; i += 1) {
      const fatia = i === 0 ? p.textoCapa : p.continuacoes[i - 1];
      expect(fatia.endsWith(" ") || fatia.endsWith("\n")).toBe(true);
    }
  });
});
