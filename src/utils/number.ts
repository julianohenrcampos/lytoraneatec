/**
 * Converte valores de entrada para números decimais, tratando formatação PT-BR
 * @param input - Valor a ser convertido (string, number ou unknown)
 * @returns Número decimal válido ou 0 se inválido
 */
export function toDecimal(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return 0;
  
  // Remove espaços, separadores de milhar e converte vírgula decimal
  const s = input.trim().replace(/\s+/g, "")
    .replace(/\./g, "")       // Remove milhares como 1.234,56
    .replace(",", ".");       // Vírgula -> ponto decimal
  
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formata número para exibição em PT-BR
 * @param value - Número a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada em PT-BR
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}