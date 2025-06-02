
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { 
  normalizeDateToBrazilianNoon, 
  getCurrentBrazilianDate, 
  formatBrazilianDateToString,
  formatBrazilianDateForDisplay 
} from "@/utils/timezoneUtils"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString?: string): string {
  return formatBrazilianDateForDisplay(dateString);
}

/**
 * Converte uma string de data (YYYY-MM-DD) para um objeto Date local
 * evitando problemas de timezone - DEPRECATED: use parseBrazilianDate
 */
export function parseLocalDate(dateString: string): Date {
  console.warn("parseLocalDate está deprecated. Use parseBrazilianDate do timezoneUtils");
  if (!dateString) {
    return new Date();
  }
  
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  } catch (error) {
    console.error("Error parsing local date:", error);
    return new Date();
  }
}

/**
 * Converte um objeto Date para string no formato YYYY-MM-DD
 * mantendo a data local - DEPRECATED: use formatBrazilianDateToString
 */
export function formatDateToString(date: Date): string {
  console.warn("formatDateToString está deprecated. Use formatBrazilianDateToString do timezoneUtils");
  return formatBrazilianDateToString(date);
}

/**
 * Normaliza uma data para meio-dia para evitar problemas de fuso horário
 * ATUALIZADA: Agora usa timezone brasileiro
 */
export function normalizeDateToNoon(date?: Date | string | null): Date {
  return normalizeDateToBrazilianNoon(date);
}

/**
 * Formats a number with thousands separator and decimal places
 * @param value The number to format
 * @param decimalPlaces Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatNumber(value?: number | string, decimalPlaces: number = 2): string {
  if (value === undefined || value === null || value === '') return '-';
  
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numberValue)) return '-';
  
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
}

// Export Brazilian timezone functions for backwards compatibility
export { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  formatBrazilianDateForDisplay,
  getCurrentBrazilianDate
} from "@/utils/timezoneUtils";
