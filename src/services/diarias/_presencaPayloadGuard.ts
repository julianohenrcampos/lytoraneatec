// =====================================================
// GUARD: Sanitização de payloads de bd_diaria_presencas
// =====================================================
// Garante que registros sem presença real nunca sejam gravados com
// valor_diaria_aplicada > 0, e que tipo_diaria nunca seja gravado como NULL.
//
// REGRAS:
// - Sem presença real (presente !== true E sem hora_entrada E sem hora_saida):
//     -> valor_diaria_aplicada = 0
//     -> tipo_diaria = 'nenhuma'
// - Com presença real e tipo_diaria nulo/ausente:
//     -> tipo_diaria = 'completa' (default seguro; refinado na finalização)
// - Helper é IMUTÁVEL: nunca muta o objeto recebido.
// - String vazia em hora_entrada/hora_saida é tratada como ausência.

export interface PresencaPayloadBase {
  solicitacao_id?: string | null;
  funcionario_id?: string | null;
  data?: string | null;
  presente?: boolean | null;
  hora_entrada?: string | null;
  hora_saida?: string | null;
  valor_diaria_aplicada?: number | null;
  tipo_diaria?: string | null;
}

export function sanearPayloadPresenca<T extends PresencaPayloadBase>(payload: T): T {
  const temHoraEntrada = payload.hora_entrada != null && payload.hora_entrada !== '';
  const temHoraSaida = payload.hora_saida != null && payload.hora_saida !== '';
  const temPresencaReal =
    payload.presente === true || temHoraEntrada || temHoraSaida;

  if (!temPresencaReal) {
    if ((payload.valor_diaria_aplicada ?? 0) > 0) {
      console.warn('[DIARIA][GUARD_ZERA_VALOR]', {
        solicitacao_id: payload.solicitacao_id ?? null,
        funcionario_id: payload.funcionario_id ?? null,
        data: payload.data ?? null,
        valor_original_recebido: payload.valor_diaria_aplicada ?? null,
        motivo: 'sem_presenca_real',
      });
    }
    return {
      ...payload,
      valor_diaria_aplicada: 0,
      tipo_diaria: 'nenhuma',
    };
  }

  if (payload.tipo_diaria == null) {
    return {
      ...payload,
      tipo_diaria: 'completa',
    };
  }

  return { ...payload };
}
