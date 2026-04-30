import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FuncionarioSelecionado } from '@/types/ssoAgendamentoExames';
import { useEscopoCentrosCusto } from '@/hooks/useEscopoCentrosCusto';

const RESULT_LIMIT = 100;

/**
 * Busca funcionários para seleção no SSO/Desligamento.
 *
 * Caminho principal (Demissional/Periódico/default): usa RPC get_funcionarios_ativos_global
 * — sem embed FK, sem RLS frágil. RPC já filtra status IN ('Ativo','Ativo sem Registro')
 * server-side e aplica busca por nome/CPF/matrícula/função.
 *
 * Caminho INSS (Retorno ao Trabalho): select simples em bd_funcionarios sem embed FK.
 *
 * Para usuários NÃO globais (ex.: AdmOBRA), aplica poda client-side por
 * centro_custo_id usando useEscopoCentrosCusto. A barreira principal contra
 * seleção fora do escopo é o handleContinue do componente — esta poda é UX.
 *
 * Lista é leve (sem endereço/banco/datas). Enriquecimento por id é feito no
 * componente de seleção (FuncionarioSelectorDialog) antes de prosseguir.
 */
export const useFuncionarioSearch = (statusFilter?: string, enabled: boolean = true) => {
  const [searchTerm, setSearchTerm] = useState('');
  const trimmedSearch = searchTerm.trim();
  const isInssPath = statusFilter === 'INSS';

  const { isGlobal, allowedCentroIds, isLoading: isLoadingEscopo } = useEscopoCentrosCusto();

  const queryEnabled = enabled && !isLoadingEscopo;

  const { data: funcionarios, isLoading, error, refetch } = useQuery<FuncionarioSelecionado[]>({
    queryKey: [
      'funcionarios-search-rpc',
      isInssPath ? 'INSS' : 'ATIVOS',
      trimmedSearch,
      isGlobal ? '__global__' : allowedCentroIds.join(','),
    ],
    enabled: queryEnabled,
    queryFn: async () => {
      // ---------- Caminho INSS ----------
      if (isInssPath) {
        let q = supabase
          .from('bd_funcionarios')
          .select('id, nome_completo, cpf, status, funcao_id, centro_custo_id, empresa_id, matricula, email')
          .eq('status', 'INSS')
          .order('nome_completo')
          .limit(RESULT_LIMIT);

        if (trimmedSearch) {
          const onlyDigits = trimmedSearch.replace(/\D/g, '');
          if (onlyDigits.length >= 3) {
            q = q.or(`nome_completo.ilike.%${trimmedSearch}%,cpf.ilike.%${onlyDigits}%`);
          } else {
            q = q.ilike('nome_completo', `%${trimmedSearch}%`);
          }
        }

        const { data, error: err } = await q;
        if (err) throw err;

        let rows = data || [];

        // Poda por escopo (UX) — barreira principal está no handleContinue.
        if (!isGlobal) {
          const allowed = new Set(allowedCentroIds);
          rows = rows.filter((r) => r.centro_custo_id && allowed.has(r.centro_custo_id));
        }

        // enriquece nome_funcao com 1 select extra (payload trivial — máx ~2 INSS)
        const funcaoIds = Array.from(new Set(rows.map(r => r.funcao_id).filter(Boolean) as string[]));
        let funcoesMap: Record<string, string> = {};
        if (funcaoIds.length > 0) {
          const { data: funcoes } = await supabase
            .from('bd_funcoes')
            .select('id, nome_funcao')
            .in('id', funcaoIds);
          funcoesMap = (funcoes || []).reduce((acc, f: any) => {
            acc[f.id] = f.nome_funcao;
            return acc;
          }, {} as Record<string, string>);
        }

        return rows.map((r): FuncionarioSelecionado => ({
          id: r.id,
          nome_completo: r.nome_completo,
          email: r.email ?? null,
          cpf: r.cpf,
          data_nascimento: null,
          telefone_celular: null,
          funcao: r.funcao_id ? (funcoesMap[r.funcao_id] || '') : '',
          empresa: '',
          centro_custo: null,
          centro_custo_id: r.centro_custo_id ?? null,
          banco_agencia: null,
          banco_conta: null,
          endereco_rua: null,
          endereco_numero: null,
          endereco_bairro: null,
          endereco_cidade: null,
          endereco_estado: null,
          endereco_cep: null,
          data_admissao: null,
        }));
      }

      // ---------- Caminho principal: RPC ----------
      const { data, error: err } = await supabase.rpc('get_funcionarios_ativos_global', {
        p_search: trimmedSearch || null,
        p_limit: RESULT_LIMIT,
        p_centro_custo: null,
      });
      if (err) throw err;

      let rows = ((data || []) as any[]);

      // Poda por escopo (UX) — barreira principal está no handleContinue.
      if (!isGlobal) {
        const allowed = new Set(allowedCentroIds);
        rows = rows.filter((r) => r.centro_custo_id && allowed.has(r.centro_custo_id));
      }

      return rows.map((r): FuncionarioSelecionado => ({
        id: r.id,
        nome_completo: r.nome_completo,
        email: r.email ?? null,
        cpf: r.cpf,
        data_nascimento: null,
        telefone_celular: null,
        funcao: r.nome_funcao || '',
        empresa: '',
        centro_custo: null,
        centro_custo_id: r.centro_custo_id ?? null,
        banco_agencia: null,
        banco_conta: null,
        endereco_rua: null,
        endereco_numero: null,
        endereco_bairro: null,
        endereco_cidade: null,
        endereco_estado: null,
        endereco_cep: null,
        data_admissao: null,
      }));
    },
  });

  const list = useMemo(() => funcionarios || [], [funcionarios]);

  return {
    funcionarios: list,
    allFuncionarios: list,
    isLoading: isLoading || isLoadingEscopo,
    error,
    refetch,
    searchTerm,
    setSearchTerm,
    hasSearchTerm: trimmedSearch.length > 0,
    resultLimit: RESULT_LIMIT,
  };
};
