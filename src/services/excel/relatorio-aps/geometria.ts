/**
 * Geometria fixa do Excel do Relatório AP's.
 * Coluna A = margem (vazia). Tabela ocupa B:R.
 *
 * Posições centralizadas em constantes — não espalhar números pelo código.
 */
export const LARGURAS_COLUNAS = {
  A: 4.25,
  B: 27.375,   // LOGRADOURO
  C: 14.875,   // SITUAÇÃO
  D: 22.0,     // ATIVIDADE
  E: 13.625,   // DATA
  F: 11.125,   // TRECHO
  G: 13.125,   // EXTENSÃO
  H: 5.625,    // m x
  I: 12.375,   // LARGURA
  J: 5.625,    // m =
  K: 13.625,   // ÁREA
  L: 5.625,    // m² x
  M: 12.625,   // ESPESSURA
  N: 5.625,    // m x
  O: 14.625,   // PESO ESPECÍFICO
  P: 6.5,      // t/m³ =
  Q: 23.375,   // TOTAL
  R: 5.625,    // t
} as const;

export const COLUNAS_ORDENADAS: Array<keyof typeof LARGURAS_COLUNAS> = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I",
  "J", "K", "L", "M", "N", "O", "P", "Q", "R",
];

/** Cabeçalho da tabela em B:R — R intencionalmente vazio (null). */
export const CABECALHO_TABELA: Record<string, string | null> = {
  B: "LOGRADOURO",
  C: "SITUAÇÃO",
  D: "ATIVIDADE",
  E: "DATA",
  F: "TRECHO",
  G: "EXTENSÃO",
  H: "m x",
  I: "LARGURA",
  J: "m =",
  K: "ÁREA",
  L: "m² x",
  M: "ESPESSURA",
  N: "m x",
  O: "PESO ESPECÍFICO",
  P: "t/m³ =",
  Q: "TOTAL",
  R: null,
};

/** Colunas que compõem conectores textuais (não são bold). */
export const COLUNAS_CONECTOR = new Set(["H", "J", "L", "N", "P"]);

/** Linhas fixas — fonte única de verdade. */
export const LINHA_INSTITUCIONAL = 1;
export const LINHA_TITULO_TABELA = 3;
export const LINHA_CABECALHO_TABELA = 4;
export const PRIMEIRA_LINHA_DADOS = 5;

/** Coluna final da tabela. */
export const COLUNA_FINAL = "R";

/** Assinatura de arquivo PNG (magic number). */
export const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
