/**
 * Geometria determinística da tabela do Relatório AP's em PowerPoint.
 * Unidades em polegadas para posições/tamanhos; pt para fontes.
 *
 * Slide widescreen 13.33" × 7.5".
 */
export const APS_PPTX_TABLE_LAYOUT = {
  x: 0.30,
  y: 1.00,
  w: 12.73,
  headerH: 0.32,
  groupH: 0.30,
  detailH: 0.30,
  totalH: 0.34,
  footerY: 7.15,
  fontSize: 8,
  headerFontSize: 10,
  groupFontSize: 10,
  totalFontSize: 11,
  colW: [
    3.30, // Logradouro
    1.20, // Situação
    0.90, // Data
    0.80, // Trecho
    0.95, // Extensão (m)
    0.95, // Largura (m)
    1.15, // Área (m²)
    1.05, // Espessura (m)
    1.23, // Peso Esp. (t/m³)
    1.20, // Total (t)
  ],
} as const;

export const APS_PPTX_SLIDE = {
  wIn: 13.33,
  hIn: 7.50,
  margin: 0.30,
} as const;

/** Área útil vertical entre y do topo da tabela e footerY. */
export const APS_PPTX_TABLE_USEFUL_H =
  APS_PPTX_TABLE_LAYOUT.footerY - APS_PPTX_TABLE_LAYOUT.y;

/**
 * Capacidade em unidades visuais (faixa e detalhe têm mesma altura = 0.30).
 * Header consome headerH; total consome totalH somente no slide final.
 */
export const APS_PPTX_CAPACIDADE_PADRAO = Math.floor(
  (APS_PPTX_TABLE_USEFUL_H - APS_PPTX_TABLE_LAYOUT.headerH) /
    APS_PPTX_TABLE_LAYOUT.detailH,
); // 19

export const APS_PPTX_CAPACIDADE_ULTIMA = Math.floor(
  (APS_PPTX_TABLE_USEFUL_H -
    APS_PPTX_TABLE_LAYOUT.headerH -
    APS_PPTX_TABLE_LAYOUT.totalH) /
    APS_PPTX_TABLE_LAYOUT.detailH,
); // 18
