/**
 * Tipos da camada de "lotes" para Diárias — Fase 1A.
 *
 * Esta camada é puramente conceitual no frontend. Não altera schema, RLS,
 * triggers, RPCs ou comportamento atual. Serve como abstração TS sobre o
 * jsonb `bd_diaria_solicitacoes.convocados_pre`, tratado como um lote
 * implícito que cobre todo o período da solicitação semanal (modelo legado).
 *
 * Quando a Fase 2 introduzir o modelo relacional dedicado, esta tipagem
 * passa a refletir múltiplos lotes explícitos por solicitação.
 */

/**
 * Origem do lote:
 * - 'legado'     → derivado de convocados_pre (jsonb único cobrindo todo o período).
 * - 'explicito'  → criado pelo usuário em UI futura (Fase 2). Não usado em produção na Fase 1.
 */
export type LoteOrigem = 'legado' | 'explicito';

/**
 * Funcionário convocado dentro de um lote. Mantém os mesmos campos que hoje
 * existem em cada item de `convocados_pre`. Campos extras desconhecidos
 * recebidos no jsonb são preservados em `extras` para garantir round-trip
 * funcional sem perda de informação para PDFs/relatórios/snapshots legados.
 */
export interface ConvocadoLote {
  funcionario_id: string;
  funcao_id: string;
  nome_funcionario: string;
  nome_funcao: string;
  cpf?: string | null;
  matricula?: string | null;
  valor_diaria: number;
  valor_diaria_exclusiva?: number | null;
  valor_refeicao: number;
  /**
   * Campos adicionais presentes no jsonb original que não fazem parte do
   * contrato conhecido. Devem ser preservados na ida e na volta.
   */
  extras?: Record<string, unknown>;
}

/**
 * Lote de aprovação de diária. Na Fase 1 sempre representa o período inteiro
 * da solicitação semanal (lote implícito legado).
 */
export interface LoteDiaria {
  /** Identificador estável apenas em memória (não persistido na Fase 1). */
  id: string;
  /** Nome opcional para UI; ausente no modelo legado. */
  nome?: string;
  /** Datas (YYYY-MM-DD) cobertas por este lote. */
  datas: string[];
  /** Funcionários aprovados neste lote. */
  funcionarios: ConvocadoLote[];
  origem: LoteOrigem;
}

/**
 * Visão derivada usada pelos consumidores (componentes/hooks). Provê acesso
 * tanto à lista de lotes quanto a um índice por data, evitando que cada
 * consumidor reimplemente a interpretação do jsonb cru.
 */
export interface LotesDiariaView {
  lotes: LoteDiaria[];
  /**
   * Índice auxiliar: para cada data (YYYY-MM-DD), lista os funcionários
   * aprovados naquela data (união entre todos os lotes que cobrem a data).
   */
  funcionariosPorData: Map<string, ConvocadoLote[]>;
  /** Período coberto, derivado da solicitação semanal. */
  periodo: { inicio: string; fim: string };
}

/**
 * Mensagem padrão exibida quando o apontamento for bloqueado por ausência
 * de aprovação para a data. Mantida como constante para que toda a UI/serviço
 * que precise informar o operador use exatamente o mesmo texto.
 *
 * NOTA: na Fase 1 esta mensagem ainda NÃO é exibida em produção; a regra
 * atual de bloqueio segue inalterada. A constante existe para consumo
 * futuro pelas Fases 1C/2.
 */
export const MENSAGEM_BLOQUEIO_APROVACAO_LOTE =
  'Este funcionário não possui aprovação de diária para esta data. Solicite um complemento de aprovação.';
