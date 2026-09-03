/**
 * Realtime hook para Chamados Internos.
 * Assina APENAS bd_chamados_internos e bd_chamado_interno_eventos.
 * Invalida lista, item específico e eventos, o que refaz o Kanban também.
 * Cleanup via supabase.removeChannel — evita loop de reconexão.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CHAMADOS_INTERNOS_KEYS } from "@/hooks/useChamadosInternos";

interface Options {
  /** habilita/desabilita subscrição (default true) */
  enabled?: boolean;
}

export function useChamadosInternosRealtime(opts: Options = {}) {
  const { enabled = true } = opts;
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    interface RtRow {
      id?: string;
      chamado_id?: string;
    }

    const channel = supabase
      .channel("chamados-internos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bd_chamados_internos" },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ["chamados-internos", "lista"] });
          void qc.invalidateQueries({ queryKey: ["chamados-internos", "fila-atendimento"] });
          const row = (payload.new ?? payload.old) as RtRow | null;
          const id = row?.id;
          if (id) {
            void qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.item(id) });
            void qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.eventos(id) });
            void qc.invalidateQueries({
              queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", id),
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bd_chamado_interno_eventos" },
        (payload) => {
          const row = (payload.new ?? payload.old) as RtRow | null;
          const chamadoId = row?.chamado_id;
          if (chamadoId) {
            void qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.eventos(chamadoId) });
            void qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.item(chamadoId) });
            void qc.invalidateQueries({
              queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", chamadoId),
            });
          }
          void qc.invalidateQueries({ queryKey: ["chamados-internos", "lista"] });
          void qc.invalidateQueries({ queryKey: ["chamados-internos", "fila-atendimento"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
