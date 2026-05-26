// =====================================================
// Fase D — Elegibilidade por célula (funcionário × data)
// Função pura, sem React, 100% testável.
//
// Define quando uma célula da matriz Fase B:
//   - pode ser marcada (checkbox habilitado),
//   - nasce marcada (default ao adicionar funcionário),
//   - quando bloqueada, qual o motivo / tooltip.
//
// Regras (ordem de precedência):
//   1. Conflito (alocação em outra solicitação naquela data) -> bloqueado.
//   2. Bloqueio duro pela RPC de elegibilidade do período   -> bloqueado.
//   3. Status Inativo / Aviso Prévio / INSS                -> bloqueado.
//   4. Status Férias                                       -> elegível em qualquer dia.
//   5. Dia útil normal (sem regra operacional/laranja):
//        - com matrícula (Remessa) e solicitação 'normal'  -> bloqueado (motivo remessa_dia_util).
//        - sem matrícula                                   -> elegível.
//   6. Dia laranja operacional / sábado / fds / feriado    -> elegível para todos.
// =====================================================

export type StatusFuncionario =
  | 'Ativo'
  | 'Ativo sem Registro'
  | 'Aviso Prévio'
  | 'Inativo'
  | 'INSS'
  | 'Férias'
  | string;

export type TipoDiaMatriz = 'util' | 'sabado' | 'fds' | 'feriado';

export interface ContextoCelula {
  temMatricula: boolean;
  status: StatusFuncionario | null | undefined;
  tipoDia: TipoDiaMatriz;
  isOperacional: boolean;
  temConflito: boolean;
  bloqueadoElegibilidadeRPC: boolean;
  tipoSolicitacao: 'normal' | 'extraordinaria';
}

export type MotivoInelegibilidade =
  | null
  | 'remessa_dia_util'
  | 'conflito'
  | 'bloqueado_rpc'
  | 'inativo'
  | 'inss'
  | 'aviso_previo';

export interface ResultadoElegibilidade {
  podeMarcar: boolean;
  marcarPorPadrao: boolean;
  motivo: MotivoInelegibilidade;
  tooltip?: string;
}

const STATUS_BLOQUEADO: Record<string, MotivoInelegibilidade> = {
  Inativo: 'inativo',
  INSS: 'inss',
  'Aviso Prévio': 'aviso_previo',
};

export function avaliarCelula(ctx: ContextoCelula): ResultadoElegibilidade {
  if (ctx.temConflito) {
    return {
      podeMarcar: false,
      marcarPorPadrao: false,
      motivo: 'conflito',
      tooltip: 'Funcionário já alocado em outra solicitação nesta data.',
    };
  }
  // Em Extraordinária, o bloqueio da RPC (vínculo/período semanal) NÃO
  // trava células — o bloqueio por data específica vem via `temConflito`
  // (datas_bloqueio = presença real). Status RH estrutural ainda barra
  // logo abaixo. Em Normal, mantém o bloqueio duro.
  if (ctx.bloqueadoElegibilidadeRPC && ctx.tipoSolicitacao !== 'extraordinaria') {
    return {
      podeMarcar: false,
      marcarPorPadrao: false,
      motivo: 'bloqueado_rpc',
      tooltip: 'Funcionário bloqueado para o período pela validação de elegibilidade.',
    };
  }

  const motivoStatus = ctx.status ? STATUS_BLOQUEADO[ctx.status] : null;
  if (motivoStatus) {
    return {
      podeMarcar: false,
      marcarPorPadrao: false,
      motivo: motivoStatus,
      tooltip: `Status ${ctx.status} não permite apontamento.`,
    };
  }

  // Férias — sempre elegível, nasce marcado.
  if (ctx.status === 'Férias') {
    return { podeMarcar: true, marcarPorPadrao: true, motivo: null };
  }

  const isDiaUtilNormal = ctx.tipoDia === 'util' && !ctx.isOperacional;

  if (isDiaUtilNormal) {
    const remessaBloqueia =
      ctx.temMatricula && ctx.tipoSolicitacao !== 'extraordinaria';
    if (remessaBloqueia) {
      return {
        podeMarcar: false,
        marcarPorPadrao: false,
        motivo: 'remessa_dia_util',
        tooltip: 'Funcionário com remessa não recebe diária em dia útil normal.',
      };
    }
    return { podeMarcar: true, marcarPorPadrao: true, motivo: null };
  }

  // sábado | fds | feriado | dia útil operacional (laranja)
  return { podeMarcar: true, marcarPorPadrao: true, motivo: null };
}
