// Hook auxiliar — identifica presenças de diária originadas pelo ponto eletrônico
// (integração Ponto → Diária). Não-bloqueante: erro vira Set vazio.
//
// IMPORTANTE (Fase 1 Shadow): só consideramos origem REAL quando status === 'auto_apontado'.
// Registros com sufixo '_simulado' (ex.: 'auto_apontado_simulado') são apenas observabilidade
// shadow e NÃO devem ser tratados como integração real até a Fase 2.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOrigemPontoEletronico(presencaIds: (string | undefined | null)[]) {
  const [origens, setOrigens] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = Array.from(new Set(presencaIds.filter(Boolean) as string[]));
    if (ids.length === 0) {
      setOrigens(new Set());
      return;
    }
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from("bd_ponto_diaria_integracao" as any)
        .select("presenca_diaria_id, status")
        .in("presenca_diaria_id", ids)
        .eq("status", "auto_apontado");
      if (cancelado) return;
      if (error) {
        setOrigens(new Set());
        return;
      }
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r?.presenca_diaria_id) set.add(r.presenca_diaria_id);
      });
      setOrigens(set);
    })();
    return () => {
      cancelado = true;
    };
  }, [presencaIds.join(",")]);

  return origens;
}
