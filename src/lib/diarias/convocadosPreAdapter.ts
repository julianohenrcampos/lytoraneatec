/**
 * Adapter de leitura/escrita do jsonb `bd_diaria_solicitacoes.convocados_pre`.
 *
 * Fase 1A — APENAS BIBLIOTECA. Este módulo:
 *  - NÃO altera schema, RLS, triggers, RPCs, services, hooks ou componentes.
 *  - NÃO muda comportamento visível ao usuário.
 *  - NÃO grava no banco; apenas converte estruturas em memória.
 *
 * Modelo:
 *  - Em produção, `convocados_pre` é um array de convocados cobrindo toda
 *    a solicitação semanal. Tratamos isso como UM lote implícito legado
 *    (origem='legado') cobrindo o período inteiro [inicio, fim].
 *
 * Garantia de equivalência funcional (não byte):
 *  - Campos conhecidos são normalizados (números viram number, strings
 *    triviais permanecem). Campos extras desconhecidos são preservados em
 *    `extras` e devolvidos no jsonb na escrita, para não quebrar PDFs,
 *    relatórios, snapshots ou fluxos legados que dependam deles.
 */

import {
  ConvocadoLote,
  LoteDiaria,
  LotesDiariaView,
  MENSAGEM_BLOQUEIO_APROVACAO_LOTE,
} from '@/types/diarias/lotes';

// ===== Constantes internas =====

const ID_LOTE_LEGADO = 'lote-legado-implicito';

/**
 * Campos do contrato conhecido de `convocados_pre`. Tudo fora dessa lista
 * é considerado "extra desconhecido" e preservado em `extras`.
 */
const CAMPOS_CONHECIDOS = new Set<string>([
  'funcionario_id',
  'funcao_id',
  'nome_funcionario',
  'nome_funcao',
  'cpf',
  'matricula',
  'valor_diaria',
  'valor_diaria_exclusiva',
  'valor_refeicao',
]);

// ===== Helpers =====

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = toNumber(value, NaN);
  return Number.isFinite(n) ? n : null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return String(value);
}

function toRequiredString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Enumera datas (YYYY-MM-DD) de `inicio` a `fim` inclusive, em UTC,
 * evitando deslocamentos de fuso. Datas devem vir no formato ISO date
 * (YYYY-MM-DD). Se o intervalo for inválido, devolve [].
 */
function enumerarDatas(inicio: string, fim: string): string[] {
  if (!inicio || !fim) return [];
  const ini = new Date(`${inicio}T00:00:00Z`);
  const end = new Date(`${fim}T00:00:00Z`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < ini) return [];

  const out: string[] = [];
  const cursor = new Date(ini);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function extrairExtras(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const extras: Record<string, unknown> = {};
  let temExtras = false;
  for (const key of Object.keys(raw)) {
    if (!CAMPOS_CONHECIDOS.has(key)) {
      extras[key] = raw[key];
      temExtras = true;
    }
  }
  return temExtras ? extras : undefined;
}

function normalizarConvocado(item: unknown): ConvocadoLote | null {
  if (!isPlainObject(item)) return null;

  const funcionario_id = toRequiredString(item.funcionario_id);
  const funcao_id = toRequiredString(item.funcao_id);
  if (!funcionario_id || !funcao_id) {
    // Sem identificadores não há como integrar com o resto do sistema.
    // Ignora silenciosamente em vez de derrubar a leitura inteira.
    return null;
  }

  const convocado: ConvocadoLote = {
    funcionario_id,
    funcao_id,
    nome_funcionario: toRequiredString(item.nome_funcionario),
    nome_funcao: toRequiredString(item.nome_funcao),
    cpf: toNullableString(item.cpf),
    matricula: toNullableString(item.matricula),
    valor_diaria: toNumber(item.valor_diaria, 0),
    valor_diaria_exclusiva: toNullableNumber(item.valor_diaria_exclusiva),
    valor_refeicao: toNumber(item.valor_refeicao, 0),
  };

  const extras = extrairExtras(item);
  if (extras) convocado.extras = extras;

  return convocado;
}

// ===== API pública =====

/**
 * Interpreta `convocados_pre` (jsonb cru) como uma `LotesDiariaView`
 * contendo um único lote legado cobrindo o período inteiro da solicitação.
 *
 * @param raw     Valor cru lido de `bd_diaria_solicitacoes.convocados_pre`.
 *                Aceita array, objeto ou null/undefined; só extrai dados
 *                úteis se for um array. Qualquer outra forma resulta em
 *                lote vazio (sem quebrar).
 * @param periodo `{ inicio, fim }` da solicitação (datas YYYY-MM-DD).
 */
export function lerConvocadosPre(
  raw: unknown,
  periodo: { inicio: string; fim: string },
): LotesDiariaView {
  const datas = enumerarDatas(periodo.inicio, periodo.fim);

  const itens: ConvocadoLote[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const conv = normalizarConvocado(item);
      if (conv) itens.push(conv);
    }
  }

  const lote: LoteDiaria = {
    id: ID_LOTE_LEGADO,
    datas,
    funcionarios: itens,
    origem: 'legado',
  };

  const funcionariosPorData = new Map<string, ConvocadoLote[]>();
  for (const data of datas) {
    funcionariosPorData.set(data, itens.slice());
  }

  return {
    lotes: itens.length === 0 && datas.length === 0 ? [] : [lote],
    funcionariosPorData,
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
  };
}

/**
 * Devolve um valor pronto para gravar na coluna jsonb `convocados_pre`,
 * partindo de uma `LotesDiariaView`. A saída é um array de convocados
 * (achatamento de todos os lotes), reproduzindo o formato hoje aceito
 * pelos consumidores legados.
 *
 * Equivalência: funcional, NÃO byte-equivalente.
 *  - Campos conhecidos saem com a chave canônica.
 *  - `extras` são re-espalhados no objeto raiz, preservando informação
 *    desconhecida originalmente lida.
 *  - Em caso de duplicidade (funcionario_id repetido em lotes diferentes),
 *    a primeira ocorrência prevalece.
 */
export function gravarConvocadosPre(view: LotesDiariaView): unknown {
  const seen = new Set<string>();
  const flat: Array<Record<string, unknown>> = [];

  for (const lote of view.lotes) {
    for (const f of lote.funcionarios) {
      if (seen.has(f.funcionario_id)) continue;
      seen.add(f.funcionario_id);

      const item: Record<string, unknown> = {
        ...(f.extras ?? {}),
        funcionario_id: f.funcionario_id,
        funcao_id: f.funcao_id,
        nome_funcionario: f.nome_funcionario,
        nome_funcao: f.nome_funcao,
        cpf: f.cpf ?? null,
        matricula: f.matricula ?? null,
        valor_diaria: f.valor_diaria,
        valor_diaria_exclusiva: f.valor_diaria_exclusiva ?? null,
        valor_refeicao: f.valor_refeicao,
      };
      flat.push(item);
    }
  }

  return flat;
}

/**
 * Devolve a lista plana e deduplicada (por `funcionario_id`) de todos os
 * convocados de uma `LotesDiariaView`, preservando a ordem de primeira
 * aparição entre lotes. Equivale, no modelo legado, ao array original
 * `convocados_pre`, mas continua correto quando houver:
 *   - mais de um lote (Fase 2),
 *   - lotes pontuais com `origem_inclusao = 'apontamento_dia'`,
 *   - lotes explícitos futuros.
 *
 * Use sempre este helper em vez de `view.lotes[0]?.funcionarios` para
 * contagens, listagens de detalhe e popular formulários de edição.
 */
export function derivarFuncionariosPlanos(view: LotesDiariaView): ConvocadoLote[] {
  const seen = new Set<string>();
  const out: ConvocadoLote[] = [];
  for (const lote of view.lotes) {
    for (const f of lote.funcionarios) {
      if (seen.has(f.funcionario_id)) continue;
      seen.add(f.funcionario_id);
      out.push(f);
    }
  }
  return out;
}

/**
 * Indica se um funcionário está aprovado para uma data específica dentro
 * de uma `LotesDiariaView`. No modelo legado (Fase 1), basta o funcionário
 * estar no lote implícito que cobre o período.
 *
 * NÃO consumido por componentes na Fase 1A — exposto apenas para preparar
 * Fase 1B/1C/2.
 */
export function funcionarioAprovadoNaData(
  view: LotesDiariaView,
  funcionario_id: string,
  data: string,
): boolean {
  const lista = view.funcionariosPorData.get(data);
  if (!lista) return false;
  return lista.some((c) => c.funcionario_id === funcionario_id);
}

/**
 * Devolve a mensagem padronizada de bloqueio. Recebe os parâmetros para
 * permitir, no futuro, parametrização (ex.: nome do funcionário/data),
 * mantendo hoje uma mensagem fixa para evitar mudança de comportamento.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function mensagemBloqueioParaData(funcionario_id: string, data: string): string {
  return MENSAGEM_BLOQUEIO_APROVACAO_LOTE;
}
