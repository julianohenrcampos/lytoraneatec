
/**
 * UUIDs das categorias de ativos (bd_categorias_ativos).
 * Após reorganização: apenas VEÍCULO e EQUIPAMENTO.
 */
export const CATEGORIA_IDS = {
  VEICULO: 'a1b2c3d4-1111-4000-8000-000000000001',
  EQUIPAMENTO: 'bb095908-3160-45eb-b7aa-cbebeeaa15ee',
  /** @deprecated Use VEICULO instead */
  CAMINHAO: 'a1b2c3d4-1111-4000-8000-000000000001',
} as const;

/** IDs de todas as categorias de veículos */
export const VEICULOS_CATEGORIA_IDS = [
  CATEGORIA_IDS.VEICULO,
];

/** Todos os IDs de categoria (veículos + equipamentos) */
export const TODAS_CATEGORIAS_IDS = [
  CATEGORIA_IDS.VEICULO,
  CATEGORIA_IDS.EQUIPAMENTO,
];
