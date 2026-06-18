import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { algumaClinicaAbertaAgora } from '@/utils/sso/validarJanelaClinica';

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
  ativo: boolean | null;
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
  /** Data/hora atual do servidor (UTC-3) com drift local aplicado. Null enquanto carrega. */
  nowServer: Date | null;
  /** Clínicas ativas brutas; usado pelo submit para revalidar o gate. */
  clinicas: ClinicaJanela[] | null;
}

function parseHora(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function calcularProximaAbertura(clinicas: ClinicaJanela[], agora: Date): string | null {
  let melhor: { ts: number; label: string } | null = null;
  for (const c of clinicas) {
    if (c.ativo === false) continue;
    const dias = c.dias_atendimento && c.dias_atendimento.length > 0
      ? c.dias_atendimento
      : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const ini = (c.horario_inicio || '07:00').substring(0, 5);
    for (let offset = 0; offset < 8; offset++) {
      const cand = new Date(agora);
      cand.setDate(cand.getDate() + offset);
      const diaNome = DIAS_MAP[cand.getDay()];
      if (!dias.includes(diaNome)) continue;
      const [h, m] = ini.split(':').map(Number);
      cand.setHours(h, m || 0, 0, 0);
      if (offset === 0) {
        const atual = agora.getHours() * 60 + agora.getMinutes();
        if (parseHora(ini) <= atual) continue;
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
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_locais_atendimento')
        .select('id, nome_local, ativo, dias_atendimento, horario_inicio, horario_fim')
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as ClinicaJanela[];
    },
  });

  const { data: serverSnapshot, isLoading: loadingNow } = useQuery({
    queryKey: ['fn_server_now_brt'],
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_server_now_brt' as any);
      if (error) throw error;
      // Guarda o instante local do fetch para aplicar drift entre refetchs.
      return {
        serverIso: data as unknown as string,
        fetchedAtLocal: Date.now(),
      };
    },
  });

  // Tick a cada 30s para reavaliar o relógio (gate fica "vivo" entre refetchs).
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const isLoading = loadingClinicas || loadingNow;

  // FAIL-CLOSED: enquanto não temos dados, o botão fica desabilitado.
  if (!clinicas || !serverSnapshot) {
    return {
      podeAgendar: false,
      motivoBloqueio: 'Verificando horário das clínicas...',
      proximaAbertura: null,
      isLoading,
      clinicasAbertas: 0,
      totalAtivas: 0,
      nowServer: null,
      clinicas: null,
    };
  }

  // serverIso vem como 'YYYY-MM-DD HH:mm:ss' já em UTC-3 (sem TZ).
  // Aplicamos drift do relógio local desde o último fetch para não "congelar".
  const base = new Date(serverSnapshot.serverIso.replace(' ', 'T'));
  const driftMs = Date.now() - serverSnapshot.fetchedAtLocal;
  const agora = new Date(base.getTime() + driftMs);

  const status = algumaClinicaAbertaAgora(clinicas, agora);

  if (status.algumaAberta) {
    return {
      podeAgendar: true,
      motivoBloqueio: '',
      proximaAbertura: null,
      isLoading: false,
      clinicasAbertas: status.abertasAgora,
      totalAtivas: status.totalAtivas,
      nowServer: agora,
      clinicas,
    };
  }

  const proxima = calcularProximaAbertura(clinicas, agora);
  return {
    podeAgendar: false,
    motivoBloqueio: proxima
      ? `Agendamento bloqueado: todas as clínicas estão fechadas no momento. Próxima abertura: ${proxima}.`
      : status.motivo || 'Agendamento bloqueado: todas as clínicas estão fechadas no momento.',
    proximaAbertura: proxima,
    isLoading: false,
    clinicasAbertas: 0,
    totalAtivas: status.totalAtivas,
    nowServer: agora,
    clinicas,
  };
}
