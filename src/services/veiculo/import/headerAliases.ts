const HEADER_ALIASES: Record<string, string[]> = {
  item: ['ITEM', 'ITEM.', 'ITEM#', 'Nº ITEM', 'N° ITEM'],
  obra: ['OBRA', 'CÓDIGO OBRA', 'CODIGO OBRA'],
  obra_descricao: ['DESCRIÇÃO OBRA', 'DESCRICAO OBRA', 'DESCRIÇÃO DA OBRA'],
  frota: ['FROTA', 'CÓDIGO FROTA', 'CODIGO FROTA', 'CÓDIGO ATIVO', 'CODIGO ATIVO'],
  tipo: ['TIPO DE EQUIPAMENTO', 'TIPO EQUIPAMENTO', 'TIPO'],
  contrato: ['CONTRATO'],
  fabricante: ['FABRICANTE'],
  modelo: ['MODELO'],
  ano: ['ANO FABRICAÇÃO', 'ANO FABRICACAO', 'ANO DE FABRICAÇÃO', 'ANO DE FABRICACAO'],
  empresa: ['EMPRESA'],
  operador: ['C/ OPERADOR/ MOTORISTA ?', 'COM OPERADOR', 'COM OPERADOR/MOTORISTA'],
  valor: ['VALOR', 'VALOR MENSAL', 'VALOR (R$)'],
};

function normHeader(v: unknown): string {
  return String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function mapHeaderRow(row: unknown[]): Record<string, number> {
  const idx: Record<string, number> = {};
  const norm = row.map(normHeader);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const normalizedAliases = aliases.map(normHeader);
    const found = norm.findIndex((h) => normalizedAliases.includes(h));
    if (found >= 0) idx[key] = found;
  }
  return idx;
}
