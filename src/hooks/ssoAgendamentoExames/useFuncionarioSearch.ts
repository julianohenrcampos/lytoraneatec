import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FuncionarioSelecionado } from '@/types/ssoAgendamentoExames';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';
import { excludeRestrictedCCFuncionarios } from '@/utils/centroCustoRestrictions';

interface FuncionarioRaw {
  id: string;
  nome_completo: string;
  email: string | null;
  cpf: string;
  data_nascimento: string | null;
  agencia: string | null;
  conta_corrente: string | null;
  bd_funcoes: { nome_funcao: string } | null;
  bd_empresas: { nome_empresa: string } | null;
  bd_centros_custo: { nome_centro_custo: string } | null;
}

export const useFuncionarioSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isSuperAdmin } = useDynamicPermissions();

  const { data: funcionariosRaw, isLoading } = useQuery({
    queryKey: ['funcionarios-ativos', isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('bd_funcionarios')
        .select(`
          id, 
          nome_completo, 
          email, 
          cpf, 
          data_nascimento,
          agencia,
          conta_corrente,
          bd_funcoes(nome_funcao),
          bd_empresas(nome_empresa),
          bd_centros_custo!bd_funcionarios_centro_custo_id_fkey(nome_centro_custo)
        `)
        .eq('status', 'Ativo');
      
      // Excluir funcionários do CC DIR001 para não-SuperAdmin
      query = await excludeRestrictedCCFuncionarios(query, isSuperAdmin);
      
      const { data, error } = await query.order('nome_completo');
      if (error) throw error;
      return data as FuncionarioRaw[];
    }
  });

  // Mapear dados raw para FuncionarioSelecionado
  const funcionarios: FuncionarioSelecionado[] = useMemo(() => {
    if (!funcionariosRaw) return [];
    
    return funcionariosRaw.map(func => ({
      id: func.id,
      nome_completo: func.nome_completo,
      email: func.email,
      cpf: func.cpf,
      data_nascimento: func.data_nascimento,
      telefone_celular: null, // Não existe no cadastro de funcionários
      funcao: func.bd_funcoes?.nome_funcao || '',
      empresa: func.bd_empresas?.nome_empresa || '',
      centro_custo: func.bd_centros_custo?.nome_centro_custo || null,
      banco_agencia: func.agencia,
      banco_conta: func.conta_corrente
    }));
  }, [funcionariosRaw]);

  // Filtrar funcionários baseado no termo de busca (apenas por nome)
  const filteredFuncionarios = useMemo(() => {
    if (!searchTerm.trim()) return funcionarios;
    
    const term = searchTerm.toLowerCase();
    return funcionarios.filter(func => 
      func.nome_completo.toLowerCase().includes(term)
    );
  }, [funcionarios, searchTerm]);

  return { 
    funcionarios: filteredFuncionarios, 
    allFuncionarios: funcionarios,
    isLoading, 
    searchTerm, 
    setSearchTerm 
  };
};
