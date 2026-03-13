/**
 * Converts text to uppercase. Safe for null/undefined values.
 */
export const toUpperCaseText = (text?: string | null): string => {
  if (!text) return "";
  return text.toUpperCase().trim();
};

/**
 * Formats a CPF string (digits only) into the masked format: 000.000.000-00
 * Handles partial input for live typing.
 */
export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

/**
 * Strips CPF mask, returning only digits.
 */
export const stripCPF = (value: string): string => {
  return value.replace(/\D/g, "");
};
