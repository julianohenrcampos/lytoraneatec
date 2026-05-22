/**
 * Fonte ÚNICA de verdade para classificar uma presença/dia entre
 * "FINAL_SEMANA_FERIADO" (FDS / Feriado / Ponte) e "DIA_UTIL_SEMANA"
 * em TODOS os relatórios e dashboards de Diárias.
 *
 * MODO DUPLO (ver `opts.modo`):
 *
 *  - 'snapshot' (DEFAULT): visão financeira/histórica.
 *      Prioridade: snapshot_presenca → calendario_feriado → fim_semana → dia_util.
 *      Usado por PDFs e exports oficiais, que devem refletir o estado
 *      do apontamento no momento em que ele foi gravado/fechado.
 *
 *  - 'operacional': visão gerencial/atual.
 *      Prioridade: calendario_operacional (regra vigente do CC) →
 *      snapshot_presenca → calendario_feriado → fim_semana → dia_util.
 *      Usado por dashboards de gestão, que precisam refletir mudanças
 *      tardias no `bd_diaria_calendario_operacional`.
 *
 * NUNCA misturar as duas visões na mesma tela/relatório sem deixar
 * explícito ao usuário (ver tooltip do gráfico Tipo de Dia).
 */

export type GrupoRelatorio = 'FINAL_SEMANA_FERIADO' | 'DIA_UTIL_SEMANA';

export type OrigemRegraClassificacao =
  | 'calendario_operacional'
  | 'snapshot_presenca'
  | 'calendario_feriado'
  | 'fim_semana'
  | 'dia_util';

export type ModoClassificacao = 'snapshot' | 'operacional';

export interface ClassificacaoDiaRelatorio {
  grupo_relatorio: GrupoRelatorio;
  usar_valor_exclusivo: boolean;
  origem_regra: OrigemRegraClassificacao;
}

export interface ClassificavelDia {
  /** ISO date (YYYY-MM-DD ou com sufixo de tempo — só os 10 primeiros chars são usados). */
  data: string | null | undefined;
  /** Snapshot persistido em bd_diaria_presencas.usar_diaria_exclusiva. */
  usar_diaria_exclusiva?: boolean | null;
  /**
   * Regra ATUAL do bd_diaria_calendario_operacional (escopo centro_custo, ativo=true),
   * exposta pelas views vw_diarias_* / vw_relatorio_diarias_folha como coluna
   * derivada `usar_diaria_exclusiva_calendario`. NULL = sem override vigente.
   */
  usar_diaria_exclusiva_calendario?: boolean | null;
}

export interface OpcoesClassificacao {
  modo?: ModoClassificacao;
}

function toGrupo(exclusivo: boolean, origem: OrigemRegraClassificacao): ClassificacaoDiaRelatorio {
  return {
    grupo_relatorio: exclusivo ? 'FINAL_SEMANA_FERIADO' : 'DIA_UTIL_SEMANA',
    usar_valor_exclusivo: exclusivo,
    origem_regra: origem,
  };
}

function fallbackCalendarioEDia(
  item: ClassificavelDia,
  feriadosSet?: Set<string> | null,
): ClassificacaoDiaRelatorio {
  const dataStr = (item.data || '').substring(0, 10);
  if (!dataStr) return toGrupo(false, 'dia_util');
  if (feriadosSet && feriadosSet.has(dataStr)) return toGrupo(true, 'calendario_feriado');
  const d = new Date(dataStr + 'T12:00:00');
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return toGrupo(true, 'fim_semana');
  return toGrupo(false, 'dia_util');
}

export function classificarDiaParaRelatorio(
  item: ClassificavelDia,
  feriadosSet?: Set<string> | null,
  opts?: OpcoesClassificacao,
): ClassificacaoDiaRelatorio {
  const modo: ModoClassificacao = opts?.modo ?? 'snapshot';

  if (modo === 'operacional') {
    // 1) Calendário operacional ATUAL vence (regra vigente do CC).
    if (item.usar_diaria_exclusiva_calendario === true) {
      return toGrupo(true, 'calendario_operacional');
    }
    if (item.usar_diaria_exclusiva_calendario === false) {
      return toGrupo(false, 'calendario_operacional');
    }
    // 2) Snapshot da presença.
    if (item.usar_diaria_exclusiva === true) return toGrupo(true, 'snapshot_presenca');
    if (item.usar_diaria_exclusiva === false) return toGrupo(false, 'snapshot_presenca');
    // 3) Fallback feriado/FDS/dia útil.
    return fallbackCalendarioEDia(item, feriadosSet);
  }

  // modo 'snapshot' (default): comportamento histórico/financeiro.
  if (item.usar_diaria_exclusiva === true) return toGrupo(true, 'snapshot_presenca');
  if (item.usar_diaria_exclusiva === false) return toGrupo(false, 'snapshot_presenca');
  return fallbackCalendarioEDia(item, feriadosSet);
}

/** Tipo equivalente ao antigo `TipoDiaCategoria` do dashboard. */
export type TipoDiaCategoria = 'uteis' | 'fds_feriado';

/**
 * Wrapper compatível com a API antiga `classificarDia` do dashboard,
 * agora aceitando o objeto completo da presença e o modo.
 * Default `'snapshot'` preserva o comportamento de qualquer callsite que
 * não passe `opts`.
 */
export function classificarDia(
  input: ClassificavelDia,
  feriadosSet?: Set<string> | null,
  opts?: OpcoesClassificacao,
): TipoDiaCategoria {
  const { usar_valor_exclusivo } = classificarDiaParaRelatorio(input, feriadosSet, opts);
  return usar_valor_exclusivo ? 'fds_feriado' : 'uteis';
}
