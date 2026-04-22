import { supabase } from "@/integrations/supabase/client";

const COOLDOWN_MINUTOS = 10;

export async function verificarCooldownBatida(funcionarioId: string): Promise<{ bloqueado: boolean; minutosRestantes: number }> {
  const { data, error } = await supabase
    .from("bd_ponto_batidas")
    .select("data_hora_considerada")
    .eq("funcionario_id", funcionarioId)
    .neq("status_validacao", "invalidada")
    .order("data_hora_considerada", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.data_hora_considerada) {
    return { bloqueado: false, minutosRestantes: 0 };
  }

  const deltaMin = (Date.now() - new Date(data.data_hora_considerada).getTime()) / 60000;
  if (deltaMin >= COOLDOWN_MINUTOS) {
    return { bloqueado: false, minutosRestantes: 0 };
  }

  return {
    bloqueado: true,
    minutosRestantes: Math.max(1, Math.ceil(COOLDOWN_MINUTOS - deltaMin)),
  };
}