/**
 * Restrições do Centro de Custo DIR001
 * 
 * O CC DIR001 e todos os dados vinculados a ele só podem ser visíveis
 * para usuários com permissão SuperAdm.
 */

export const RESTRICTED_CC_CODE = 'DIR001';

/**
 * Aplica filtro de exclusão do CC DIR001 em uma query Supabase.
 * Se o usuário NÃO é SuperAdmin, adiciona .neq() na query.
 */
export function excludeRestrictedCC(
  query: any,
  isSuperAdmin: boolean,
  columnName: string = 'codigo_centro_custo'
): any {
  if (!isSuperAdmin) {
    return query.neq(columnName, RESTRICTED_CC_CODE);
  }
  return query;
}

/**
 * Filtra arrays client-side removendo itens com CC DIR001.
 */
export function filterRestrictedCCFromArray<T>(
  items: T[],
  isSuperAdmin: boolean,
  codeField: keyof T = 'codigo_centro_custo' as keyof T
): T[] {
  if (isSuperAdmin) return items;
  return items.filter(item => item[codeField] !== RESTRICTED_CC_CODE);
}

// Cache do UUID do CC DIR001
let restrictedCCIdCache: string | null = null;

/**
 * Busca e cacheia o UUID do CC DIR001.
 * Usado para filtrar funcionários vinculados.
 */
export async function getRestrictedCCId(): Promise<string | null> {
  if (restrictedCCIdCache) return restrictedCCIdCache;

  const { supabase } = await import('@/integrations/supabase/client');
  const { data } = await supabase
    .from('bd_centros_custo')
    .select('id')
    .eq('codigo_centro_custo', RESTRICTED_CC_CODE)
    .maybeSingle();

  if (data) {
    restrictedCCIdCache = data.id;
  }
  return restrictedCCIdCache;
}

/**
 * Aplica filtro de exclusão de funcionários vinculados ao CC DIR001.
 */
export async function excludeRestrictedCCFuncionarios(
  query: any,
  isSuperAdmin: boolean
): Promise<any> {
  if (isSuperAdmin) return query;
  
  const ccId = await getRestrictedCCId();
  if (ccId) {
    return query.neq('centro_custo_id', ccId);
  }
  return query;
}
