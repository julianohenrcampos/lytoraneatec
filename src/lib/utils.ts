
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  
  try {
    // Check if the date is in ISO format or just a date string
    let date: Date;
    if (dateString.includes('T')) {
      // ISO format
      date = new Date(dateString);
    } else {
      // Just date string (YYYY-MM-DD)
      const [year, month, day] = dateString.split('-').map(Number);
      // Create date with noon time to avoid timezone issues
      date = new Date(year, month - 1, day, 12, 0, 0);
    }
    
    // Format the date
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
}

/**
 * Normaliza uma data para meio-dia para evitar problemas de fuso horário
 * @param date A data a ser normalizada (opcional - se não fornecida, usa a data atual)
 * @returns Data normalizada para meio-dia
 */
export function normalizeDateToNoon(date?: Date | string | null): Date {
  if (!date) {
    // Se a data não for fornecida, retorna SEMPRE a data atual normalizada para meio-dia
    const today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12, 0, 0
    );
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    console.error("Data inválida fornecida para normalização:", date);
    // Retorna a data atual normalizada em caso de data inválida
    const today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12, 0, 0
    );
  }
  
  // Configura a data para meio-dia local para evitar problemas de fuso horário
  return new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    12, 0, 0
  );
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
