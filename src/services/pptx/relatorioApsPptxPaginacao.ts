/**
 * Paginação determinística da tabela e das observações do Relatório AP's PPTX.
 * Zero side-effects. Puro.
 */
import type { RelatorioApsLinha } from "@/types/relatorioAps";
import type { GrupoLinhas } from "@/lib/relatorio-aps/agrupar";
import {
  APS_PPTX_CAPACIDADE_PADRAO,
  APS_PPTX_CAPACIDADE_ULTIMA,
} from "./relatorioApsPptxLayout";

export interface FaixaSlide {
  grupo: GrupoLinhas;
  linhas: RelatorioApsLinha[];
  continuacao: boolean;
}

export interface SlideTabela {
  faixas: FaixaSlide[];
  ultimaDaTabela: boolean;
}

export interface PaginarTabelaOpts {
  capacidadePadrao?: number;
  capacidadeUltima?: number;
}

interface SlideMut {
  faixas: FaixaSlide[];
  usadas: number;
}

function contarDetalhes(s: SlideMut): number {
  return s.faixas.reduce((acc, f) => acc + f.linhas.length, 0);
}

/**
 * Paginação:
 *  - Cada faixa e cada detalhe consomem 1 unidade visual.
 *  - Slides padrão comportam `capacidadePadrao` (default 19).
 *  - O slide final reserva espaço para TOTAL GERAL (`capacidadeUltima`, default 18).
 *  - Nunca gera slide contendo apenas TOTAL GERAL (o slide final sempre terá ≥ 1 detalhe).
 *  - Preserva ordem e não omite nenhuma linha.
 */
export function paginarTabelaPptx(
  grupos: GrupoLinhas[],
  opts: PaginarTabelaOpts = {},
): SlideTabela[] {
  const capPadrao = opts.capacidadePadrao ?? APS_PPTX_CAPACIDADE_PADRAO;
  const capUltima = opts.capacidadeUltima ?? APS_PPTX_CAPACIDADE_ULTIMA;

  const slides: SlideMut[] = [];
  let atual: SlideMut = { faixas: [], usadas: 0 };

  const flush = () => {
    if (atual.faixas.length > 0) {
      slides.push(atual);
      atual = { faixas: [], usadas: 0 };
    }
  };

  for (const grupo of grupos) {
    let i = 0;
    let continuacao = false;
    while (i < grupo.linhas.length) {
      // precisamos de ao menos faixa (1) + detalhe (1) = 2 unidades
      if (capPadrao - atual.usadas < 2) flush();
      const faixa: FaixaSlide = { grupo, linhas: [], continuacao };
      atual.faixas.push(faixa);
      atual.usadas += 1;
      const restCap = capPadrao - atual.usadas;
      const take = Math.min(restCap, grupo.linhas.length - i);
      faixa.linhas = grupo.linhas.slice(i, i + take);
      atual.usadas += take;
      i += take;
      continuacao = true;
      if (atual.usadas >= capPadrao) flush();
    }
  }
  if (atual.faixas.length > 0) slides.push(atual);

  if (slides.length === 0) {
    return [];
  }

  // Garantir que o último slide comporta o TOTAL GERAL.
  const ultimo = slides[slides.length - 1];
  if (ultimo.usadas > capUltima) {
    // Migrar a última linha de detalhe do último slide para um novo slide final.
    const ultimaFaixa = ultimo.faixas[ultimo.faixas.length - 1];
    const linhaMigrada = ultimaFaixa.linhas.pop()!;
    ultimo.usadas -= 1;
    if (ultimaFaixa.linhas.length === 0) {
      // remove faixa vazia (que virou órfã) e devolve sua unidade
      ultimo.faixas.pop();
      ultimo.usadas -= 1;
    }
    const grupoMigrado = ultimaFaixa.grupo;
    const novoSlide: SlideMut = {
      faixas: [
        {
          grupo: grupoMigrado,
          linhas: [linhaMigrada],
          continuacao: true,
        },
      ],
      usadas: 2,
    };
    slides.push(novoSlide);
  }

  // Se o último slide ficou sem detalhes (não deveria acontecer com a lógica acima),
  // fallback defensivo: migrar do slide anterior.
  const finalIdx = slides.length - 1;
  if (contarDetalhes(slides[finalIdx]) === 0 && finalIdx > 0) {
    const anterior = slides[finalIdx - 1];
    const faixaAnt = anterior.faixas[anterior.faixas.length - 1];
    const linhaMigrada = faixaAnt.linhas.pop()!;
    anterior.usadas -= 1;
    slides[finalIdx].faixas.push({
      grupo: faixaAnt.grupo,
      linhas: [linhaMigrada],
      continuacao: true,
    });
    slides[finalIdx].usadas += 2;
  }

  return slides.map((s, idx) => ({
    faixas: s.faixas,
    ultimaDaTabela: idx === slides.length - 1,
  }));
}

// ============ Observações ============

export interface PlanoObservacoesPptx {
  textoCapa: string;
  continuacoes: string[];
}

export interface PlanejarObservacoesOpts {
  charsCapa: number;
  charsContinuacao: number;
}

/**
 * Divide o texto integral em capa + continuações sem perder um único caractere.
 * Regras:
 *  - vazio → "Sem observações finais" e nenhuma continuação;
 *  - cabe no `charsCapa` → capa recebe tudo;
 *  - senão → capa recebe a primeira fatia; continuações recebem o restante;
 *  - divisão preferencial em fim de parágrafo, quebra de linha ou espaço;
 *  - nunca corta palavra quando existir separador anterior;
 *  - concat(capa, ...continuacoes) === textoIntegral.
 */
export function planejarObservacoesPptx(
  textoIntegral: string | null | undefined,
  opts: PlanejarObservacoesOpts,
): PlanoObservacoesPptx {
  const texto = typeof textoIntegral === "string" ? textoIntegral : "";
  if (texto.trim() === "") {
    return { textoCapa: "Sem observações finais", continuacoes: [] };
  }
  if (texto.length <= opts.charsCapa) {
    return { textoCapa: texto, continuacoes: [] };
  }

  const fatias: string[] = [];
  let i = 0;
  let limite = opts.charsCapa;
  while (i < texto.length) {
    const restante = texto.length - i;
    if (restante <= limite) {
      fatias.push(texto.slice(i));
      break;
    }
    const janela = texto.slice(i, i + limite);
    let cut: number;
    const pPar = janela.lastIndexOf("\n\n");
    const pNl = janela.lastIndexOf("\n");
    const pSp = janela.lastIndexOf(" ");
    if (pPar > 0) cut = pPar + 2;
    else if (pNl > 0) cut = pNl + 1;
    else if (pSp > 0) cut = pSp + 1;
    else cut = limite; // hard cut apenas quando não existe separador
    fatias.push(texto.slice(i, i + cut));
    i += cut;
    limite = opts.charsContinuacao;
  }

  return {
    textoCapa: fatias[0],
    continuacoes: fatias.slice(1),
  };
}
