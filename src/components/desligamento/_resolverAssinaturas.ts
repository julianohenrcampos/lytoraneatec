import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve o nome do solicitante para PDFs de solicitação.
 * Ordem:
 *   1. bd_funcionarios.nome_completo (se profile.funcionario_id)
 *   2. profile.nome_completo
 *   3. '—'
 * Nunca devolve e-mail.
 */
export async function resolverNomeSolicitante(profile: {
  funcionario_id?: string | null;
  nome_completo?: string | null;
} | null | undefined): Promise<string> {
  if (!profile) return '—';
  if (profile.funcionario_id) {
    try {
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('nome_completo')
        .eq('id', profile.funcionario_id)
        .maybeSingle();
      if (data?.nome_completo?.trim()) return data.nome_completo;
    } catch {/* segue fallback */}
  }
  if (profile.nome_completo?.trim()) return profile.nome_completo;
  return '—';
}

/**
 * Diretor da Área via cadeia CC → diretoria → diretor.
 * Só preenche quando todos os itens convergem para o mesmo centro_custo_id.
 */
export async function resolverDiretorDaArea(
  centroCustoIds: Array<string | null | undefined>,
): Promise<string | null> {
  const unicos = Array.from(new Set(centroCustoIds.filter(Boolean) as string[]));
  if (unicos.length !== 1) return null;
  const ccId = unicos[0];
  try {
    const { data: cc } = await supabase
      .from('bd_centros_custo')
      .select('diretoria_id')
      .eq('id', ccId)
      .maybeSingle();
    if (!cc?.diretoria_id) return null;
    const { data: dir } = await supabase
      .from('bd_diretorias')
      .select('diretor_id')
      .eq('id', cc.diretoria_id)
      .maybeSingle();
    if (!dir?.diretor_id) return null;
    const { data: f } = await supabase
      .from('bd_funcionarios')
      .select('nome_completo')
      .eq('id', dir.diretor_id)
      .maybeSingle();
    return f?.nome_completo?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Gerente da Área via bd_centros_custo.aprovador_diarias_id.
 * Preenche somente se todos os CCs convergem para o mesmo aprovador.
 */
export async function resolverGerenteDaArea(
  centroCustoIds: Array<string | null | undefined>,
): Promise<string | null> {
  const ccUnicos = Array.from(new Set(centroCustoIds.filter(Boolean) as string[]));
  if (ccUnicos.length === 0) return null;
  try {
    const { data: ccs } = await supabase
      .from('bd_centros_custo')
      .select('id, aprovador_diarias_id')
      .in('id', ccUnicos);
    const aprovadores = Array.from(
      new Set((ccs || []).map((c: any) => c.aprovador_diarias_id).filter(Boolean)),
    ) as string[];
    if (aprovadores.length !== 1) return null;
    // Se algum CC não tem aprovador, a convergência não é total → branco.
    if ((ccs || []).some((c: any) => !c.aprovador_diarias_id)) return null;
    const { data: f } = await supabase
      .from('bd_funcionarios')
      .select('nome_completo')
      .eq('id', aprovadores[0])
      .maybeSingle();
    return f?.nome_completo?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Diretoria Financeira institucional (independe do CC).
 * Prioridade: tipo='Financeira' → nome contém 'ADM/FINANCEIRA' → nome contém 'FINANCEIRA'.
 * Múltiplos no mesmo nível: ordena por nome asc.
 */
export async function resolverDiretoriaFinanceira(): Promise<string | null> {
  try {
    const { data: dirs } = await supabase
      .from('bd_diretorias')
      .select('id, nome, tipo, diretor_id, ativo')
      .eq('ativo', true);
    if (!dirs || dirs.length === 0) return null;

    const norm = (s: string | null | undefined) => (s || '').toUpperCase();
    const porTipo = dirs.filter((d: any) => norm(d.tipo) === 'FINANCEIRA');
    const porNomeAdm = dirs.filter((d: any) => norm(d.nome).includes('ADM/FINANCEIRA'));
    const porNomeFin = dirs.filter((d: any) => norm(d.nome).includes('FINANCEIRA'));

    const escolha =
      (porTipo.length ? porTipo : porNomeAdm.length ? porNomeAdm : porNomeFin)
        .slice()
        .sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || ''))[0];

    if (!escolha?.diretor_id) return null;
    const { data: f } = await supabase
      .from('bd_funcionarios')
      .select('nome_completo')
      .eq('id', escolha.diretor_id)
      .maybeSingle();
    return f?.nome_completo?.trim() || null;
  } catch {
    return null;
  }
}
