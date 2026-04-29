// =====================================================
// Mappers compartilhados para normalização de funcionários
// retornados pelas RPCs (get_funcionarios_ativos_global,
// get_engenheiros, get_apontadores_por_cc).
// Centraliza o shape consumido pelo SmartFuncionarioSearch
// e demais modais de Diárias / Solicitação de Equipamento.
// =====================================================

export interface FuncionarioOption {
  id: string;
  nome_completo: string;
  cpf: string | null;
  funcao_id: string;
  centro_custo_id: string | null;
  matricula: string | null;
  status_funcionario: string | null;
  email: string | null;
  elegivel?: boolean;
  motivo_bloqueio?: string | null;
  fora_centro_custo_solicitacao?: boolean;
  bd_funcoes: {
    id: string;
    nome_funcao: string;
    valor_diaria: number;
    valor_diaria_exclusiva: number | null;
    valor_refeicao: number | null;
  } | null;
}

// Adapta linhas vindas das RPCs (campos achatados) para o shape
// esperado por mapFuncionarioRecord.
export const mapRpcRow = (row: any) => ({
  ...row,
  funcao_nome: row.nome_funcao ?? row.funcao_nome ?? null,
});

export const mapFuncionarioRecord = (funcionario: any): FuncionarioOption => ({
  id: funcionario.id,
  nome_completo: funcionario.nome_completo,
  cpf: funcionario.cpf ?? null,
  funcao_id: funcionario.funcao_id ?? '',
  centro_custo_id: funcionario.centro_custo_id ?? null,
  matricula: funcionario.matricula ?? null,
  status_funcionario: funcionario.status_funcionario ?? funcionario.status ?? null,
  email: funcionario.email ?? null,
  elegivel: funcionario.elegivel,
  motivo_bloqueio: funcionario.motivo_bloqueio ?? null,
  fora_centro_custo_solicitacao: funcionario.fora_centro_custo_solicitacao ?? false,
  bd_funcoes: funcionario.bd_funcoes
    ? {
        id: funcionario.bd_funcoes.id ?? funcionario.funcao_id ?? '',
        nome_funcao: funcionario.bd_funcoes.nome_funcao ?? '',
        valor_diaria: funcionario.bd_funcoes.valor_diaria ?? 0,
        valor_diaria_exclusiva: funcionario.bd_funcoes.valor_diaria_exclusiva ?? null,
        valor_refeicao: funcionario.bd_funcoes.valor_refeicao ?? null,
      }
    : (funcionario.funcao_nome
        ? {
            id: funcionario.funcao_id ?? '',
            nome_funcao: funcionario.funcao_nome,
            valor_diaria: funcionario.valor_diaria ?? 0,
            valor_diaria_exclusiva: funcionario.valor_diaria_exclusiva ?? null,
            valor_refeicao: funcionario.valor_refeicao ?? null,
          }
        : null),
});

export const mergeFuncionarios = (...listas: Array<FuncionarioOption[] | undefined>) => {
  const map = new Map<string, FuncionarioOption>();
  listas
    .flat()
    .filter((item): item is FuncionarioOption => !!item?.id)
    .forEach((item) => {
      // Não sobrescrever entrada já existente se a nova vier sem bd_funcoes (preserva enrich)
      const existing = map.get(item.id);
      if (existing && existing.bd_funcoes && !item.bd_funcoes) return;
      map.set(item.id, item);
    });
  return Array.from(map.values()).sort((a, b) =>
    a.nome_completo.localeCompare(b.nome_completo, 'pt-BR')
  );
};
