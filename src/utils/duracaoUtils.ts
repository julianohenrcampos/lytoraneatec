/**
 * Utilitário para cálculo de duração de atendimento
 * Usado no frontend para preview em tempo real
 */

export interface DuracaoAtendimento {
  dataInicio: string;
  horaInicio: string;
  dataFim: string;
  horaFim: string;
}

/**
 * Calcula duração entre data/hora de início e encerramento
 * Retorna formato: "X dia(s)" ou "X.XX hora(s)"
 */
export function calcularDuracaoAtendimento(dados: Partial<DuracaoAtendimento>): string | null {
  const { dataInicio, horaInicio, dataFim, horaFim } = dados;

  // Verifica se todos os campos necessários estão preenchidos
  if (!dataInicio || !horaInicio || !dataFim || !horaFim) {
    return null;
  }

  try {
    // Combina data + hora em objetos Date
    const inicioTs = new Date(`${dataInicio}T${horaInicio}`);
    const fimTs = new Date(`${dataFim}T${horaFim}`);

    // Valida se as datas são válidas
    if (isNaN(inicioTs.getTime()) || isNaN(fimTs.getTime())) {
      return null;
    }

    // Verifica se fim é maior que início
    if (fimTs < inicioTs) {
      return null;
    }

    // Calcula diferença em milissegundos
    const diffMs = fimTs.getTime() - inicioTs.getTime();
    
    // Converte para dias
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 1) {
      return `${diffDays} dia(s)`;
    } else {
      // Converte para horas com 2 casas decimais
      const diffHours = diffMs / (1000 * 60 * 60);
      return `${diffHours.toFixed(2)} hora(s)`;
    }
  } catch (error) {
    console.error('Erro ao calcular duração:', error);
    return null;
  }
}

/**
 * Valida se os dados de duração são consistentes
 */
export function validarDuracaoAtendimento(dados: Partial<DuracaoAtendimento>): {
  isValid: boolean;
  error?: string;
} {
  const { dataInicio, horaInicio, dataFim, horaFim } = dados;

  if (!dataInicio && !horaInicio && !dataFim && !horaFim) {
    return { isValid: true }; // Campos vazios são válidos
  }

  if (!dataInicio || !horaInicio || !dataFim || !horaFim) {
    return { 
      isValid: false, 
      error: 'Todos os campos de data/hora devem ser preenchidos para calcular a duração' 
    };
  }

  try {
    const inicioTs = new Date(`${dataInicio}T${horaInicio}`);
    const fimTs = new Date(`${dataFim}T${horaFim}`);

    if (isNaN(inicioTs.getTime()) || isNaN(fimTs.getTime())) {
      return { 
        isValid: false, 
        error: 'Data ou hora inválida' 
      };
    }

    if (fimTs < inicioTs) {
      return { 
        isValid: false, 
        error: 'Data/hora de encerramento deve ser posterior ao início' 
      };
    }

    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: 'Erro ao validar data/hora' 
    };
  }
}