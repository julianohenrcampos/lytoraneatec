import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Abastecimento, AbastecimentoFiltros } from '@/types/abastecimento';

export const useAbastecimentos = (token: string | null) => {
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarAbastecimentos = async (filtros: AbastecimentoFiltros = {}, saveToCache: boolean = true) => {
    if (!token) {
      setError('Token não fornecido');
      toast.error('Token de autenticação não encontrado');
      return { success: false, error: 'Token não fornecido' };
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Buscando abastecimentos da API GuardianWeb...', filtros);

      const { data, error: functionError } = await supabase.functions.invoke(
        'guardian-web-proxy',
        {
          body: {
            token,
            dataIni: filtros.dataInicio,
            dataFim: filtros.dataFim,
            placa: filtros.placa,
            frota: filtros.frota,
            saveToCache
          },
          method: 'POST'
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao conectar com o serviço');
      }

      if (data?.erro || data?.erros) {
        const errorMsg = data.erro || data.erros?.[0] || 'Erro ao buscar abastecimentos';
        throw new Error(errorMsg);
      }

      let dados: Abastecimento[] = data?.dados || [];

      // Aplicar filtros adicionais no frontend
      if (filtros.comboista) {
        dados = dados.filter(a => a.comboista?.includes(filtros.comboista!));
      }
      if (filtros.combustivel) {
        dados = dados.filter(a => a.combustivel === filtros.combustivel);
      }
      if (filtros.cc) {
        dados = dados.filter(a => a.cc?.includes(filtros.cc!));
      }

      setAbastecimentos(dados);
      console.log(`✅ ${dados.length} abastecimentos encontrados`);
      toast.success(`${dados.length} abastecimentos carregados`);
      
      return { success: true, dados };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar dados';
      setError(errorMessage);
      toast.error(`Erro: ${errorMessage}`);
      console.error('❌ Erro ao buscar abastecimentos:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const buscarDoCache = async (filtros: AbastecimentoFiltros = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('💾 Buscando abastecimentos do cache local...', filtros);

      let query = supabase
        .from('bd_abastecimentos')
        .select('*')
        .order('data_abast', { ascending: false });

      if (filtros.dataInicio) {
        query = query.gte('data_abast', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_abast', filtros.dataFim);
      }
      if (filtros.frota) {
        query = query.eq('frota', filtros.frota);
      }
      if (filtros.placa) {
        query = query.eq('placa', filtros.placa);
      }
      if (filtros.comboista) {
        query = query.ilike('comboista', `%${filtros.comboista}%`);
      }
      if (filtros.combustivel) {
        query = query.eq('combustivel', filtros.combustivel);
      }
      if (filtros.cc) {
        query = query.ilike('cc', `%${filtros.cc}%`);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;

      setAbastecimentos(data || []);
      console.log(`✅ ${data?.length || 0} abastecimentos encontrados no cache`);
      toast.success(`${data?.length || 0} registros carregados do cache`);
      
      return { success: true, dados: data || [] };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar cache';
      setError(errorMessage);
      toast.error(`Erro: ${errorMessage}`);
      console.error('❌ Erro ao buscar do cache:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const limparDados = () => {
    setAbastecimentos([]);
    setError(null);
  };

  return {
    abastecimentos,
    isLoading,
    error,
    buscarAbastecimentos,
    buscarDoCache,
    limparDados
  };
};
