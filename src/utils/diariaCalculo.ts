/**
 * Cálculo unificado de breakdown financeiro de uma diária.
 *
 * REGRA OFICIAL DEFINITIVA (sem arredondamento financeiro):
 *
 *  valor_diaria_aplicada já é a fonte única de verdade financeira e
 *  já contém o multiplicador do tipo de diária:
 *    - completa    = base × 1.0
 *    - uma_e_meia  = base × 1.5
 *    - meia        = base × 0.5
 *    - nenhuma     = 0
 *
 *  total_linha = Number(valor_diaria_aplicada || 0)
 *              + Number(valor_refeicao_aplicado || 0)
 *
 *  Nenhum relatório deve:
 *    - somar meia diária novamente por cima de valor_diaria_aplicada;
 *    - aplicar Math.ceil / Math.round / round2 em valor financeiro;
 *    - recalcular valor histórico pela tabela atual de função.
 *
 *  A decomposição visual (V. Diária / V. ½ Diária) é APENAS para exibição
 *  e NUNCA altera o total oficial:
 *    - completa:    diaria = aplicado;          meia = 0
 *    - uma_e_meia:  diaria = aplicado * 2/3;    meia = aplicado * 1/3
 *    - meia:        diaria = 0;                 meia = aplicado
 *    - nenhuma:     diaria = 0;                 meia = 0
 *
 *  diaria + meia ≡ aplicado (matematicamente, sem arredondamento).
 */

export interface DiariaBreakdown {
  diaria: number;   // V. Diária (decomposição visual)
  meia: number;     // V. ½ Diária (decomposição visual)
  refeicao: number; // V. Refeição
  total: number;    // OFICIAL: aplicado + refeicao (sem arredondar)
}

export interface DiariaCalculoInput {
  tipo_diaria?: string | null;
  valor_diaria_aplicada?: number | null;
  valor_refeicao_aplicado?: number | null;
}

export function calcularBreakdownDiaria(item: DiariaCalculoInput): DiariaBreakdown {
  const aplicado = Number(item.valor_diaria_aplicada || 0);
  const refeicao = Number(item.valor_refeicao_aplicado || 0);

  let diaria = 0;
  let meia = 0;

  switch (item.tipo_diaria) {
    case 'completa':
      diaria = aplicado;
      break;
    case 'uma_e_meia':
      // base × 1.5 = base + base/2 → diaria=2/3 do aplicado, meia=1/3 do aplicado
      diaria = aplicado * (2 / 3);
      meia = aplicado * (1 / 3);
      break;
    case 'meia':
      meia = aplicado;
      break;
    default:
      // 'nenhuma' ou desconhecido → tudo zero
      break;
  }

  return {
    diaria,
    meia,
    refeicao,
    // TOTAL OFICIAL: soma direta dos campos persistidos, sem arredondamento.
    total: aplicado + refeicao,
  };
}
