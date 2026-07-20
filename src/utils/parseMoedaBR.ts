// Rodada 2A.3 — Parser tolerante de moeda BR para aluguel.
// 'R$ 14.000,00' → '14000.00' ; 'R$ -' → null ; '#REF!' → null ; vazio → null.

export function parseMoedaBR(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s0 = String(raw).trim();
  if (!s0) return null;
  const upper = s0.toUpperCase();
  if (upper.startsWith("#")) return null; // #REF!, #VALUE!, etc.
  // Remove R$, espaços e caractere não-numérico exceto vírgula, ponto e sinal.
  const stripped = s0.replace(/r\$/gi, "").replace(/\s+/g, "").trim();
  if (!stripped || stripped === "-" || stripped === "R$-") return null;
  // Formato BR: milhar '.', decimal ','.
  const normalized = stripped
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}
