/**
 * Cálculo unificado de breakdown financeiro de uma diária.
 *
 * Regra de negócio (oficial):
 *  - tipo_diaria='completa'   → V. Diária = base, V. ½ Diária = 0
 *  - tipo_diaria='uma_e_meia' → V. Diária = base, V. ½ Diária = base / 2  (1 + 1/2)
 *  - tipo_diaria='meia'       → V. ½ Diária = valor_meia_diaria_aplicada (se existir)
 *                                ou base / 2 como fallback
 *
 * IMPORTANTE: a regra antiga (2/3 + 1/3) está DEPRECIADA e foi substituída
 * por esta. Centralizar TODO cálculo de exibição/exportação aqui.
 *
 * Arredondamento monetário: 2 casas decimais, preservando centavos.
 */

export interface DiariaBreakdown {
  diaria: number;   // V. Diária
  meia: number;     // V. ½ Diária
  refeicao: number; // V. Refeição
  total: number;
}

export interface DiariaCalculoInput {
  tipo_diaria?: string | null;
  valor_diaria_aplicada?: number | null;
  valor_refeicao_aplicado?: number | null;
  /** Futuro-proof: se a coluna existir no DB, prioriza para tipo='meia'. */
  valor_meia_diaria_aplicada?: number | null;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function calcularBreakdownDiaria(item: DiariaCalculoInput): DiariaBreakdown {
  const base = Number(item.valor_diaria_aplicada || 0);
  const refeicao = Number(item.valor_refeicao_aplicado || 0);
  const meiaCampo = Number(item.valor_meia_diaria_aplicada || 0);

  let diaria = 0;
  let meia = 0;

  switch (item.tipo_diaria) {
    case 'completa':
      diaria = base;
      break;
    case 'uma_e_meia':
      diaria = base;
      meia = base / 2; // 1 diária + 1/2 diária
      break;
    case 'meia':
      meia = meiaCampo > 0 ? meiaCampo : base / 2;
      break;
    default:
      // 'nenhuma' ou desconhecido → tudo zero
      break;
  }

  const diariaR = round2(diaria);
  const meiaR = round2(meia);
  const refeicaoR = round2(refeicao);

  return {
    diaria: diariaR,
    meia: meiaR,
    refeicao: refeicaoR,
    total: round2(diariaR + meiaR + refeicaoR),
  };
}
