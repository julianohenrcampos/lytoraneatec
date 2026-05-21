import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DIAS_MAP: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

interface ClinicaJanela {
  id: string;
  nome_local: string;
  dias_atendimento: string[] | null;
  horario_inicio: string | null;
  horario_fim: string | null;
}

interface Resultado {
  podeAgendar: boolean;
  motivoBloqueio: string;
  proximaAbertura: string | null;
  isLoading: boolean;
  clinicasAbertas: number;
  totalAtivas: number;
}

function parseHora(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function estaAberta(clinica: ClinicaJanela, agora: Date): boolean {
  const dias = clinica.dias_atendimento && clinica.dias_atendimento.length > 0
    ? clinica.dias_atendimento
    : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const dia = DIAS_MAP[agora.getDay()];
  if (!dias.includes(dia)) return false;
  const ini = parseHora((clinica.horario_inicio || '07:00').substring(0, 5));
  const fim = parseHora((clinica.horario_fim || '17:00').substring(0, 5));
  const atual = agora.getHours() * 60 + agora.getMinutes();
  return atual >= ini && atual < fim;
}

function calcularProximaAbertura(clinicas: ClinicaJanela[], agora: Date): string | null {
  let melhor: { ts: number; label: string } | null = null;
  for (const c of clinicas) {
    const dias = c.dias_atendimento && c.dias_atendimento.length > 0
      ? c.dias_atendimento
      : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const ini = (c.horario_inicio || '07:00').substring(0, 5);
    const iniMin = parseHora(ini);
    for (let offset = 0; offset < 8; offset++) {
      const cand = new Date(agora);
      cand.setDate(cand.getDate() + offset);
      const diaNome = DIAS_MAP[cand.getDay()];
      if (!dias.includes(diaNome)) continue;
      const [h, m] = ini.split(':').map(Number);
      cand.setHours(h, m || 0, 0, 0);
      const candMin = cand.getHours() * 60 + cand.getMinutes();
      if (offset === 0) {
        const atual = agora.getHours() * 60 + agora.getMinutes();
        if (candMin <= atual) continue;
      }
      const ts = cand.getTime();
      if (!melhor || ts < melhor.ts) {
        const labelDia = offset === 0
          ? 'hoje'
          : offset === 1
            ? 'amanhã'
            : diaNome.toLowerCase();
        melhor = { ts, label: `${labelDia} às ${ini}` };
      }
      break;
    }
  }
  return melhor?.label || null;
}

export function useClinicasAbertasAgora(enabled: boolean = true): Resultado {
  const { data: clinicas, isLoading: loadingClinicas } = useQuery({
    queryKey: ['clinicas-ativas-janela'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_locais_atendimento')
        .select('id, nome_local, dias_atendimento, horario_inicio, horario_fim')
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as ClinicaJanela[];
    },
  });

  const { data: serverNowIso, isLoading: loadingNow } = useQuery({
    queryKey: ['fn_server_now_brt'],
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_server_now_brt' as any);
      if (error) throw error;
      return data as unknown as string;
    },
  });

  // tick local a cada 30s para reavaliar enquanto o servidor não atualiza
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const isLoading = loadingClinicas || loadingNow;
  if (isLoading || !clinicas || !serverNowIso) {
    return {
      podeAgendar: true,
      motivoBloqueio: '',
      proximaAbertura: null,
      isLoading: true,
      clinicasAbertas: 0,
      totalAtivas: 0,
    };
  }

  // serverNowIso vem como 'YYYY-MM-DD HH:mm:ss' já em UTC-3 (sem TZ).
  // Aplicamos drift desde o último fetch usando Date.now() local.
  const baseServer = new Date((serverNowIso as string).replace(' ', 'T'));
  // tick é só para forçar reavaliação
  void tick;
  const agora = baseServer;

  const abertas = clinicas.filter(c => estaAberta(c, agora));
  if (abertas.length > 0) {
    return {
      podeAgendar: true,
      motivoBloqueio: '',
      proximaAbertura: null,
      isLoading: false,
      clinicasAbertas: abertas.length,
      totalAtivas: clinicas.length,
    };
  }

  const proxima = calcularProximaAbertura(clinicas, agora);
  return {
    podeAgendar: false,
    motivoBloqueio: proxima
      ? `Agendamento bloqueado: todas as clínicas estão fechadas no momento. Próxima abertura: ${proxima}.`
      : 'Agendamento bloqueado: todas as clínicas estão fechadas no momento.',
    proximaAbertura: proxima,
    isLoading: false,
    clinicasAbertas: 0,
    totalAtivas: clinicas.length,
  };
}
