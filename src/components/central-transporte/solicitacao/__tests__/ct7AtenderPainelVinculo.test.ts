/**
 * CT-7/CT-8 — Contratos de SOURCE do painel de vínculo rápido da etapa "Atender".
 * Apenas apresentação/interação: nenhuma regra de matching/RBAC/backend é testada aqui.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (f: string) => readFileSync(join(process.cwd(), "src/components/central-transporte/solicitacao", f), "utf8");

const etapa = ler("EtapaSelecao.tsx");
const receptivo = ler("ItemAlvoDropCard.tsx");
const mini = ler("AtivoMiniCard.tsx");
const grade = ler("AtivosCandidatosCards.tsx");

describe("CT-7 — Atender como painel de vínculo rápido", () => {
  it("T01 desktop em 2 colunas com receptivo à esquerda", () => {
    expect(etapa).toContain("lg:grid-cols-[360px_minmax(0,1fr)]");
    expect(etapa).toContain('data-testid="ct7-painel-vinculo"');
    expect(etapa.indexOf("ct3e-itens-alvo")).toBeLessThan(etapa.indexOf("ct7-coluna-candidatos"));
  });

  it("T02 receptivo permanece visível (sticky) no desktop", () => {
    expect(etapa).toContain("lg:sticky lg:top-4 lg:self-start");
  });

  it("T03/T04 lista da direita tem scroll interno próprio", () => {
    expect(grade).toContain('data-testid="ct8-lista-rolavel"');
    expect(grade).toContain("overflow-y-auto");
    expect(grade).toContain("overscroll-contain");
    expect(grade).toContain("max-h-[calc(100vh-280px)]");
  });

  it("T05/T06/T07 mini-cards compactos em 3 linhas organizadas", () => {
    expect(mini).toContain("px-2 py-1.5");
    // linha 1: código + origem à direita; linha 2: status + compatibilidade
    expect(mini.match(/items-center justify-between/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(mini).toContain("Compat.:");
    expect(mini).toContain("title={detalhe ?? origemCurta}");
  });

  it("T08 receptivo é dominante e não fica acima da lista", () => {
    expect(receptivo).toContain('data-receptivo="true"');
    expect(receptivo).toContain("min-h-[132px]");
  });

  it("T08b cards da direita exibem menos texto (sem parágrafos longos)", () => {
    expect(mini).not.toContain("Compatibilidade exata");
    expect(mini).not.toContain("<p ");
  });

  it("T09 Recomendados x Alternativas continuam separados", () => {
    expect(grade).toContain("agruparCandidatosPorDepartamento");
    expect(grade).toContain("ct3e-grupo-");
  });

  it("T10 busca fica fora da área rolável", () => {
    expect(grade).toContain('data-testid="ct8-busca-fixa"');
    expect(grade.indexOf("ct8-busca-fixa")).toBeLessThan(grade.indexOf("ct8-lista-rolavel"));
    expect(grade).toContain("ct3e-busca-ativos");
  });

  it("T11 drag-and-drop preservado", () => {
    expect(mini).toContain("onDragStart");
    expect(mini).toContain("CT_DND_MIME_ATIVO");
    expect(receptivo).toContain("onDrop");
    expect(receptivo).toContain("Arraste um novo ativo para substituir ou vincular");
    expect(receptivo).toContain("Arraste um ativo aqui para vincular");
    expect(etapa).toContain("soltarNoItem(item.id, equipamentoId)");
  });

  it("T12 fallback Vincular preservado", () => {
    expect(mini).toContain("ct3e-ativo-vincular-");
    expect(mini).toContain("onVincular()");
    expect(etapa).toContain("onVincular={vincularAtivo}");
  });

  it("T13 dados do receptivo preservados", () => {
    expect(receptivo).toContain("text-base font-semibold");
    expect(receptivo).toContain("Ativo escolhido");
    expect(receptivo).toContain("Alterar seleção");
    expect(receptivo).toContain("Qtd solicitada");
    expect(receptivo).toContain("Qtd reservada");
    expect(receptivo).toContain("Pendentes");
  });

  it("T05b grade densa dentro do painel rolável", () => {
    expect(grade).toContain("grid-cols-2 xl:grid-cols-3");
  });
});
