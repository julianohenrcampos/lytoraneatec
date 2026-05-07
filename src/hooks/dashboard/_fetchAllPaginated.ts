/**
 * Pagina uma query Supabase em lotes de 1000 (cap default do PostgREST),
 * sem criar RPC nem alterar banco.
 *
 * Uso:
 *   const data = await fetchAllPaginated(() =>
 *     supabase.from("bd_funcionarios").select("id, nome_completo").eq("status", "Ativo")
 *   );
 *
 * O builder DEVE ser uma função que retorna um novo PostgrestFilterBuilder a cada chamada,
 * pois aplicamos .range() em cada lote.
 */
export async function fetchAllPaginated<T = any>(
  builder: () => any,
  opts: { pageSize?: number; safetyMax?: number; label?: string } = {}
): Promise<{ data: T[]; error: any | null; pages: number }> {
  const PAGE = opts.pageSize ?? 1000;
  const SAFETY = opts.safetyMax ?? 20000;
  const label = opts.label ?? "fetchAllPaginated";

  const all: T[] = [];
  let from = 0;
  let pages = 0;

  while (true) {
    const to = from + PAGE - 1;
    const { data, error } = await builder().range(from, to);

    if (error) {
      console.error(`[${label}] erro na página ${pages} (range ${from}-${to}):`, error);
      return { data: all, error, pages };
    }

    pages += 1;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));

    if (data.length < PAGE) break;
    from += PAGE;

    if (from > SAFETY) {
      console.warn(`[${label}] safety stop em ${from} registros.`);
      break;
    }
  }

  return { data: all, error: null, pages };
}
