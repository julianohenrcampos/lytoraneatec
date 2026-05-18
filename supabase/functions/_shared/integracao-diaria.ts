// Hook único Ponto → Diária.
// Chamado pelos 3 edges que inserem em bd_ponto_batidas (registrar-ponto,
// registrar-ponto-totem, sync-ponto-offline).
//
// Regras (Fase A.2):
//  - Só dispara quando o CC tem bd_ponto_config.integracao_diaria_ativa = true.
//  - Respeita integracao_diaria_inicio (se definido).
//  - Erros nunca propagam: a batida é prioridade absoluta.
//  - A RPC fn_ponto_diaria_integrar_batida é idempotente por batida_id.

export async function integrarDiariaSeAtivado(
  supabaseAdmin: any,
  batida: {
    id: string;
    centro_custo_id: string | null | undefined;
    data_operacional?: string | null;
  },
): Promise<void> {
  try {
    if (!batida?.id || !batida?.centro_custo_id) return;

    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("bd_ponto_config")
      .select("integracao_diaria_ativa, integracao_diaria_inicio")
      .eq("centro_custo_id", batida.centro_custo_id)
      .maybeSingle();

    if (cfgErr) {
      console.error("[INTEG-DIARIA][CFG-ERR]", {
        batida_id: batida.id,
        err: cfgErr.message,
      });
      return;
    }
    if (!cfg?.integracao_diaria_ativa) return;
    if (
      cfg.integracao_diaria_inicio &&
      batida.data_operacional &&
      batida.data_operacional < cfg.integracao_diaria_inicio
    ) {
      return;
    }

    const { data, error } = await supabaseAdmin.rpc(
      "fn_ponto_diaria_integrar_batida",
      { p_batida_id: batida.id },
    );
    if (error) {
      console.error("[INTEG-DIARIA][RPC-ERR]", {
        batida_id: batida.id,
        err: error.message,
      });
    } else {
      console.log("[INTEG-DIARIA][OK]", {
        batida_id: batida.id,
        cc: batida.centro_custo_id,
        status: data,
      });
    }
  } catch (e: any) {
    console.error("[INTEG-DIARIA][CATCH]", {
      batida_id: batida?.id,
      msg: e?.message,
    });
  }
}
