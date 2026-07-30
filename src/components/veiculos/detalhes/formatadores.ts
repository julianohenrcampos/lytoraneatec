import { formatDateBR } from "@/utils/formatDateBR";

/** Texto padrão para valores ausentes. */
export const NAO_INFORMADO = "Não informado";

/** Moeda BRL a partir de string/número armazenado (não altera o valor gravado). */
export const formatAluguelBRL = (valor: string | number | null | undefined): string | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const bruto = typeof valor === "number" ? valor : String(valor).trim();
  if (typeof bruto === "string" && !/^-?\d+([.,]\d+)?$/.test(bruto.replace(/\s|R\$/g, ""))) {
    return String(valor);
  }
  const numero =
    typeof bruto === "number"
      ? bruto
      : Number(bruto.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(numero)) return String(valor);
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

/** Data pura "YYYY-MM-DD" → dd/MM/yyyy. */
export const formatDataOperacional = (
  valor: string | null | undefined,
  fallback: string,
): string => (valor ? formatDateBR(valor, fallback) : fallback);

/** Ano sem separador de milhar. */
export const formatAnoFabricacao = (valor: string | null | undefined): string | null => {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  return s.replace(/\D/g, "") || s;
};

/** Capacidade: "20" + unidade já cadastrada → "20 t"; texto livre é preservado. */
export const formatCapacidade = (valor: string | null | undefined): string | null => {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*([A-Za-zºª³/]+)?$/);
  if (!m) return s;
  const numero = m[1].replace(".", ",");
  return m[2] ? `${numero} ${m[2].toLowerCase()}` : numero;
};
