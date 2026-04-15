// =====================================================
// HOOK: ANTI-FRAUDE DE DIÁRIAS
// =====================================================

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  validarStatusFuncionario,
  validarInconsistencia30Dias,
  validarStatusPorDia,
  verificarDuplicidadeSolicitacao,
  getHistoricoStatusFuncionario,
  registrarStatusFuncionario,
  registrarLogComunicacao,
  type StatusFuncionarioResult
} from '@/services/diarias/antiFraudeService';

/**
 * Hook para validar status de funcionário em uma data
 */
export function useValidarStatusFuncionario() {
  return useMutation({
    mutationFn: async ({ funcionarioId, data }: { funcionarioId: string; data: string }) => {
      return validarStatusFuncionario(funcionarioId, data);
    }
  });
}

/**
 * Hook para validar status por dia do período (CRÍTICO)
 */
export function useValidarStatusPorDia() {
  return useMutation({
    mutationFn: async ({ funcionarioId, dataInicio, dataFim }: { funcionarioId: string; dataInicio: string; dataFim: string }) => {
      return validarStatusPorDia(funcionarioId, dataInicio, dataFim);
    }
  });
}

/**
 * Hook para validar inconsistência de 30 dias
 */
export function useValidarInconsistencia() {
  return useMutation({
    mutationFn: async ({ funcionarioId, dataReferencia }: { funcionarioId: string; dataReferencia: string }) => {
      return validarInconsistencia30Dias(funcionarioId, dataReferencia);
    }
  });
}

/**
 * Hook para verificar duplicidade de solicitação
 */
export function useVerificarDuplicidade() {
  return useMutation({
    mutationFn: async (params: {
      centroCustoId: string;
      dataInicio: string;
      dataFim: string;
      solicitacaoIdExcluir?: string;
    }) => {
      return verificarDuplicidadeSolicitacao(
        params.centroCustoId,
        params.dataInicio,
        params.dataFim,
        params.solicitacaoIdExcluir
      );
    }
  });
}

/**
 * Hook para buscar histórico de status de um funcionário
 */
export function useHistoricoStatusFuncionario(funcionarioId: string | undefined) {
  return useQuery({
    queryKey: ['funcionario-status-historico', funcionarioId],
    queryFn: () => getHistoricoStatusFuncionario(funcionarioId!),
    enabled: !!funcionarioId
  });
}

/**
 * Hook para registrar status no histórico
 */
export function useRegistrarStatus() {
  return useMutation({
    mutationFn: registrarStatusFuncionario
  });
}

/**
 * Hook para registrar log de comunicação
 */
export function useRegistrarLogComunicacao() {
  return useMutation({
    mutationFn: registrarLogComunicacao
  });
}

/**
 * Hook que executa todas as validações anti-fraude para um funcionário
 */
export function useValidacaoCompletaFuncionario() {
  return useMutation({
    mutationFn: async ({ 
      funcionarioId, 
      dataInicio, 
      dataFim 
    }: { 
      funcionarioId: string; 
      dataInicio: string; 
      dataFim: string; 
    }): Promise<{
      statusResult: StatusFuncionarioResult;
      inconsistenciaResult: { inconsistente: boolean; diasSemApontamento: number; motivo?: string };
    }> => {
      const [statusResult, inconsistenciaResult] = await Promise.all([
        validarStatusFuncionario(funcionarioId, dataInicio),
        validarInconsistencia30Dias(funcionarioId, dataInicio)
      ]);

      return { statusResult, inconsistenciaResult };
    }
  });
}
