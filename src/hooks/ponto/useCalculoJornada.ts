import { useState, useEffect } from 'react';
import { calcularJornada, type JornadaCalculada } from '@/services/ponto/calculoJornadaService';

interface UseCalculoJornadaParams {
  funcionarioId: string | null;
  dataOperacional: string | null;
}

interface UseCalculoJornadaResult {
  jornada: JornadaCalculada | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCalculoJornada({
  funcionarioId,
  dataOperacional,
}: UseCalculoJornadaParams): UseCalculoJornadaResult {
  const [jornada, setJornada] = useState<JornadaCalculada | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = () => setTrigger(t => t + 1);

  useEffect(() => {
    if (!funcionarioId || !dataOperacional) {
      setJornada(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    calcularJornada(funcionarioId, dataOperacional)
      .then(result => {
        if (!cancelled) {
          setJornada(result);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message ?? 'Erro ao calcular jornada');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [funcionarioId, dataOperacional, trigger]);

  return { jornada, isLoading, error, refetch };
}
