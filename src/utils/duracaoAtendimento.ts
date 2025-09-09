/**
 * Calcula a duração entre data/hora de início e encerramento do atendimento
 * @param dataInicio Data de início (YYYY-MM-DD)
 * @param horaInicio Hora de início (HH:MM)
 * @param dataEncerramento Data de encerramento (YYYY-MM-DD)
 * @param horaEncerramento Hora de encerramento (HH:MM)
 * @returns String formatada "X dia(s)" ou "X.XX hora(s)" ou null se dados insuficientes
 */
export function calcularDuracaoAtendimento(
  dataInicio?: string,
  horaInicio?: string,
  dataEncerramento?: string,
  horaEncerramento?: string
): string | null {
  // Verifica se todos os campos necessários estão presentes
  if (!dataInicio || !horaInicio || !dataEncerramento || !horaEncerramento) {
    return null;
  }

  try {
    // Combina data + hora para criar timestamps
    const inicioTimestamp = new Date(`${dataInicio}T${horaInicio}:00`);
    const encerramentoTimestamp = new Date(`${dataEncerramento}T${horaEncerramento}:00`);

    // Valida se as datas são válidas
    if (isNaN(inicioTimestamp.getTime()) || isNaN(encerramentoTimestamp.getTime())) {
      return null;
    }

    // Se encerramento for antes do início, retorna null
    if (encerramentoTimestamp < inicioTimestamp) {
      return null;
    }

    // Calcula diferença em milissegundos
    const diferencaMs = encerramentoTimestamp.getTime() - inicioTimestamp.getTime();
    
    // Converte para dias
    const diferencaDias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

    if (diferencaDias >= 1) {
      // Exibe em dias inteiros
      return `${diferencaDias} dia(s)`;
    } else {
      // Converte para horas com 2 casas decimais
      const diferencaHoras = diferencaMs / (1000 * 60 * 60);
      return `${diferencaHoras.toFixed(2)} hora(s)`;
    }
  } catch (error) {
    console.error('Erro ao calcular duração do atendimento:', error);
    return null;
  }
}

/**
 * Valida se a data/hora de encerramento é posterior à data/hora de início
 */
export function validarPeriodoAtendimento(
  dataInicio?: string,
  horaInicio?: string,
  dataEncerramento?: string,
  horaEncerramento?: string
): boolean {
  if (!dataInicio || !horaInicio || !dataEncerramento || !horaEncerramento) {
    return true; // Permite campos vazios
  }

  try {
    const inicioTimestamp = new Date(`${dataInicio}T${horaInicio}:00`);
    const encerramentoTimestamp = new Date(`${dataEncerramento}T${horaEncerramento}:00`);

    return encerramentoTimestamp >= inicioTimestamp;
  } catch (error) {
    return false;
  }
}