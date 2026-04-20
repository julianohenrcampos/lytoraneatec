import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FuncionarioSelecionado } from '@/types/ssoAgendamentoExames';

interface FuncionarioRaw {
  id: string;
  nome_completo: string;
  email: string | null;
  cpf: string;
  data_nascimento: string | null;
  data_admissao: string | null;
  agencia: string | null;
  conta_corrente: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  bd_funcoes: { nome_funcao: string } | null;
  bd_empresas: { nome_empresa: string } | null;
  bd_centros_custo: { nome_centro_custo: string } | null;
}

const RESULT_LIMIT = 100;

/**
 * Busca funcionários para seleção no SSO/Desligamento.
 *
 * - Server-side: filtra por nome/CPF direto na query (ilike), evitando o limite de 1000 linhas do Supabase.
 * - Status:
 *    - 'Retorno ao Trabalho' (statusFilter='INSS') -> apenas INSS
 *    - demais (Periódico, Demissional, Desligamento, Mudança de Risco) -> Ativo + Ativo sem Registro
 * - Gating: só consulta quando `enabled` (geralmente o modal aberto).
 */
export const useFuncionarioSearch = (statusFilter?: string, enabled: boolean = true) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Define lista de status aceitos
  const statusList = useMemo<string[]>(() => {
    if (statusFilter === 'INSS') return ['INSS'];
    if (statusFilter && statusFilter !== 'Ativo') return [statusFilter];
    // padrão operacional: ativos com e sem registro
    return ['Ativo', 'Ativo sem Registro'];
  }, [statusFilter]);

  const trimmedSearch = searchTerm.trim();

  const { data: funcionariosRaw, isLoading, error, refetch } = useQuery({
    queryKey: ['funcionarios-search', statusList, trimmedSearch],
    enabled,
    queryFn: async () => {
      let query = supabase
        .from('bd_funcionarios')
        .select(`
          id, 
          nome_completo, 
          email, 
          cpf, 
          data_nascimento,
          data_admissao,
          agencia,
          conta_corrente,
          endereco_rua,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          endereco_estado,
          endereco_cep,
          bd_funcoes(nome_funcao),
          bd_empresas(nome_empresa),
          bd_centros_custo!bd_funcionarios_centro_custo_id_fkey(nome_centro_custo)
        `)
        .in('status', statusList)
        .order('nome_completo')
        .limit(RESULT_LIMIT);

      if (trimmedSearch) {
        // busca por nome OU CPF (apenas dígitos do termo)
        const onlyDigits = trimmedSearch.replace(/\D/g, '');
        if (onlyDigits.length >= 3) {
          query = query.or(`nome_completo.ilike.%${trimmedSearch}%,cpf.ilike.%${onlyDigits}%`);
        } else {
          query = query.ilike('nome_completo', `%${trimmedSearch}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FuncionarioRaw[];
    }
  });

  const funcionarios: FuncionarioSelecionado[] = useMemo(() => {
    if (!funcionariosRaw) return [];

    return funcionariosRaw.map(func => ({
      id: func.id,
      nome_completo: func.nome_completo,
      email: func.email,
      cpf: func.cpf,
      data_nascimento: func.data_nascimento,
      data_admissao: func.data_admissao,
      telefone_celular: null,
      funcao: func.bd_funcoes?.nome_funcao || '',
      empresa: func.bd_empresas?.nome_empresa || '',
      centro_custo: func.bd_centros_custo?.nome_centro_custo || null,
      banco_agencia: func.agencia,
      banco_conta: func.conta_corrente,
      endereco_rua: func.endereco_rua,
      endereco_numero: func.endereco_numero,
      endereco_bairro: func.endereco_bairro,
      endereco_cidade: func.endereco_cidade,
      endereco_estado: func.endereco_estado,
      endereco_cep: func.endereco_cep,
    }));
  }, [funcionariosRaw]);

  return {
    funcionarios,
    allFuncionarios: funcionarios,
    isLoading,
    error,
    refetch,
    searchTerm,
    setSearchTerm,
    hasSearchTerm: trimmedSearch.length > 0,
    resultLimit: RESULT_LIMIT,
  };
};
