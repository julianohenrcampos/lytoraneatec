// Helpers de formatação de data DD/MM/AAAA para o módulo Planejamento Macro.
// Não usa `new Date` em strings ISO YYYY-MM-DD para evitar deslocamentos de timezone.

export function formatarDataBR(data?: string | null): string {
  if (!data) return "—";
  const iso = data.slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return data;
  return `${d}/${m}/${y}`;
}

export function formatarPeriodoBR(
  dataInicio?: string | null,
  dataFim?: string | null,
): string {
  const ini = dataInicio ? dataInicio.slice(0, 10) : null;
  const fim = dataFim ? dataFim.slice(0, 10) : null;

  if (!ini && !fim) return "—";
  if (ini && !fim) return formatarDataBR(ini);
  if (!ini && fim) return formatarDataBR(fim);
  if (ini === fim) return formatarDataBR(ini);
  return `${formatarDataBR(ini)} → ${formatarDataBR(fim)}`;
}
