// Hook auxiliar — identifica presenças de diária originadas pelo ponto eletrônico
// (Fase 1: integração Ponto → Diária). Não-bloqueante: erro vira Set vazio.

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
