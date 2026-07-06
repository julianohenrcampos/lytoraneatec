/**
 * Tipos do Relatório de AP's (montagem em memória — sem persistência).
 * Fases B.3.5-E1 e E2.
 */

export interface RelatorioApsCabecalhoEditavel {
  obra: string;
  empresa: string;
  cliente: string;
  rua: string;
  bairro: string;
  observacoes: string;
  revisao: string;
  /** Peso específico padrão (kg/m²). Default 2,40. Editável. */
  pesoEspecificoPadrao: number;
}

export interface RelatorioApsLinha {
  /** id de bd_registro_aplicacao_detalhes */
  id: string;
  sequencia: number;
  logradouro: string;
  /** ISO date (yyyy-MM-dd) */
  data: string;
  /** Editável — default: String(sequencia) */
  trecho: string;
  /** Editável — default: status do cabeçalho */
  situacao: string;
  comprimento: number | null;
  larguraMedia: number | null;
  areaAplicada: number;
  /** espessura_aplicada ?? espessura_calculada */
  espessura: number | null;
  /** Editável — default: pesoEspecificoPadrao do cabeçalho */
  pesoKgM2: number;
  /** Regra A: tonelada_aplicada * 1000. Não editável. */
  totalKg: number;
}

export interface RelatorioApsFotoDisponivel {
  /** id estável: `${detalheId}::${path}` */
  id: string;
  path: string;
  signedUrl: string;
  detalheId: string;
  sequencia: number;
  logradouro: string;
  trecho: string;
  legendaSugerida: string;
}

export interface RelatorioApsFotoSelecionada {
  /** mesmo id da foto disponível de origem */
  id: string;
  path: string;
  signedUrl: string;
  /** 1..6 */
  ordem: number;
  legenda: string;
}

export interface RelatorioApsPontoServico {
  detalheId: string;
  sequencia: number;
  latitude: number;
  longitude: number;
  logradouro: string;
}

export interface RelatorioApsCoordenada {
  latitude: number;
  longitude: number;
}

export interface RelatorioApsMapaState {
  pontosServico: RelatorioApsPontoServico[];
  linhaServico: RelatorioApsCoordenada[];
  /** Polígonos finalizados de áreas de aplicação (memória, sem persistência). */
  areasAplicacao: RelatorioApsCoordenada[][];
  /** Polígono sendo desenhado atualmente (undefined = nenhum em edição). */
  areaEmEdicao?: RelatorioApsCoordenada[];
}

export interface RelatorioApsState {
  registroId: string | null;
  carregando: boolean;
  erro: string | null;
  cabecalho: RelatorioApsCabecalhoEditavel;
  linhas: RelatorioApsLinha[];
  fotosDisponiveis: RelatorioApsFotoDisponivel[];
  fotosSelecionadas: RelatorioApsFotoSelecionada[];
  mapa: RelatorioApsMapaState;
}


export const RELATORIO_APS_PESO_DEFAULT = 2.4;
export const RELATORIO_APS_MAX_FOTOS = 6;

export const criarCabecalhoDefault = (): RelatorioApsCabecalhoEditavel => ({
  obra: "",
  empresa: "",
  cliente: "",
  rua: "",
  bairro: "",
  observacoes: "",
  revisao: "00",
  pesoEspecificoPadrao: RELATORIO_APS_PESO_DEFAULT,
});

const padOrdem = (n: number): string => String(n).padStart(2, "0");

/**
 * Legenda sugerida:
 *   - se `trecho` for numérico puro → "NN - {logradouro} (Trecho {sequencia})"
 *   - senão                         → "NN - {logradouro} ({trecho})"
 */
export function montarLegendaSugerida(
  ordem: number,
  logradouro: string,
  trecho: string,
  sequencia: number,
): string {
  const nn = padOrdem(ordem);
  const log = (logradouro || "").trim() || "Sem logradouro";
  const tr = (trecho || "").trim();
  const trechoNumerico = tr !== "" && /^\d+$/.test(tr);
  const suffix = trechoNumerico || tr === ""
    ? `Trecho ${sequencia}`
    : tr;
  return `${nn} - ${log} (${suffix})`;
}
