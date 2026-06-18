// Fase 6I.2-C — Consolidação de recursos operacionais NÃO mão-de-obra (EQ/MAT/SUB/ADM/ADM_CONTRATUAL).
// Puro, sem React. Espelha o estilo de consolidarAlocacoes do useImportarPlanejamentoObra.
//
// Regras:
// - FATURAMENTO nunca chega aqui (parser já bloqueia + assert duplo no hook).
// - EQ sem recurso_uid_externo → pendência, NÃO insere.
// - MAT sem unidade → pendência, NÃO insere.
// - MAT: nunca soma unidades diferentes — chave inclui unidade.
// - SUB/ADM: bucket por (atividade_id, UPPER(TRIM(descricao))).
//
// Saída: linhas prontas para insert (sem planejamento_id; preenchido no hook).

import type { AlocacaoPreview, FamiliaRecurso } from "./tipos";

export type TipoRecursoPersist =
  | "mao_obra"
  | "equipamento"
  | "material"
  | "subempreiteiro"
  | "administrativo";

export interface RecursoPersistInput {
  atividade_id: string;
  tipo_recurso: TipoRecursoPersist;
  funcao_id: string | null;
  tipo_equipamento_id: string | null;
  descricao: string;
  unidade: string | null;
  quantidade_prevista: number;
  horas_previstas: number | null;
  dias_previstos: number | null;
  observacao: string | null;
  grupo: "INSUMOS";
  familia: string; // "MOD"|"MOI"|"EQ"|"MAT"|"SUB"|"ADM"|"ADM_CONTRATUAL"
  atividade_uid_externo: string | null;
  recurso_uid_externo: string | null;
  data_necessaria_inicio: string | null;
  data_necessaria_fim: string | null;
  status_origem: "planejado";
}

export interface PendenciaItem {
  atividade_uid_externo: string | null;
  descricao: string;
}

export interface PendenciasNaoMaoObra {
  eqSemUid: PendenciaItem[];
  matSemUnidade: PendenciaItem[];
}

export interface AtividadeRef {
  id: string;
  data_inicio: string;
  data_fim: string;
  uidTarefa: string | null;
}

export function familiaParaTipoRecurso(f: FamiliaRecurso): TipoRecursoPersist | null {
  switch (f) {
    case "MOD":
    case "MOI":
      return "mao_obra";
    case "EQ":
      return "equipamento";
    case "MAT":
      return "material";
    case "SUB":
      return "subempreiteiro";
    case "ADM":
    case "ADM_CONTRATUAL":
      return "administrativo";
    default:
      return null;
  }
}

function defaultUnidade(tipo: TipoRecursoPersist): string {
  if (tipo === "subempreiteiro") return "vb";
  return "h";
}

function normDesc(s: string | null): string {
  return (s ?? "").trim().toUpperCase();
}

interface Bucket {
  atividade_ref: AtividadeRef;
  tipo: TipoRecursoPersist;
  familia: FamiliaRecurso;
  descricao: string;
  unidade: string | null;
  recurso_uid_externo: string | null;
  somaHoras: number | null;
  somaUnidades: number;
  origens: AlocacaoPreview[];
}

export function consolidarRecursosNaoMaoObra(
  alocacoes: AlocacaoPreview[],
  mapLinhaParaAtividade: Map<number, AtividadeRef>,
): { rows: RecursoPersistInput[]; pendencias: PendenciasNaoMaoObra } {
  const pendencias: PendenciasNaoMaoObra = { eqSemUid: [], matSemUnidade: [] };
  const buckets = new Map<string, Bucket>();

  for (const a of alocacoes) {
    if (a.motivoIgnorado !== null) continue;
    if (a.vinculoAtividadeLinha === null) continue;

    const fam = a.familiaEfetiva;
    const tipo = familiaParaTipoRecurso(fam);
    // Apenas tipos não mão-de-obra
    if (!tipo || tipo === "mao_obra") continue;

    // Segurança extra: nunca aceitar grupo != INSUMOS
    if (a.grupo !== "INSUMOS") continue;

    const ativ = mapLinhaParaAtividade.get(a.vinculoAtividadeLinha);
    if (!ativ) continue;

    const descBruta = a.nomeRecurso ?? "";
    const descKey = normDesc(descBruta);
    if (!descKey) continue;

    // EQ sem UID externo → pendência (não chave de bucket)
    if (tipo === "equipamento") {
      const uid = (a.uidRecurso ?? "").trim();
      if (!uid) {
        pendencias.eqSemUid.push({
          atividade_uid_externo: ativ.uidTarefa,
          descricao: descBruta,
        });
        continue;
      }
    }

    // MAT sem unidade → pendência
    let unidadeFinal: string | null = null;
    if (tipo === "material") {
      // Buscar unidade do recurso a partir do catálogo já não disponível aqui.
      // O MS Project geralmente não traz unidade na atribuição; usamos null se ausente.
      // Sem unidade → pendência (não persiste).
      // Como AlocacaoPreview não carrega unidadeMedida, derivamos de "unidades" (numérico) inválido para isso.
      // Convenção: usar campo descrito no nome do recurso — mas sem fonte confiável, marcamos pendência.
      // OBS: se no futuro o parser anexar unidade textual ao recurso, atualizar aqui.
      unidadeFinal = null;
      pendencias.matSemUnidade.push({
        atividade_uid_externo: ativ.uidTarefa,
        descricao: descBruta,
      });
      continue;
    } else {
      unidadeFinal = defaultUnidade(tipo);
    }

    // Chave de bucket
    let chave: string;
    if (tipo === "equipamento") {
      chave = `${ativ.id}|EQ|${(a.uidRecurso ?? "").trim()}`;
    } else if (tipo === "subempreiteiro") {
      chave = `${ativ.id}|SUB|${descKey}`;
    } else {
      // administrativo
      chave = `${ativ.id}|ADM|${descKey}`;
    }

    let b = buckets.get(chave);
    if (!b) {
      b = {
        atividade_ref: ativ,
        tipo,
        familia: fam,
        descricao: descBruta,
        unidade: unidadeFinal,
        recurso_uid_externo: a.uidRecurso ?? null,
        somaHoras: null,
        somaUnidades: 0,
        origens: [],
      };
      buckets.set(chave, b);
    }
    if (a.trabalhoHoras !== null && Number.isFinite(a.trabalhoHoras)) {
      b.somaHoras = (b.somaHoras ?? 0) + Number(a.trabalhoHoras);
    }
    if (a.unidades !== null && Number.isFinite(a.unidades) && Number(a.unidades) > 0) {
      b.somaUnidades += Number(a.unidades);
    } else {
      b.somaUnidades += 1;
    }
    b.origens.push(a);
  }

  const rows: RecursoPersistInput[] = [];
  for (const b of buckets.values()) {
    const horas = b.somaHoras;
    const dias = horas !== null && horas > 0 ? Number((horas / 8).toFixed(4)) : null;
    const qtd = Math.max(1, Number(b.somaUnidades.toFixed(4)));

    const uids = b.origens.map((o) => o.uidRecurso ?? "?").join(", ");
    const observacao =
      b.origens.length > 1
        ? `Importado do cronograma — consolidado de ${b.origens.length} alocações (UIDs Recurso: ${uids}; Família: ${b.familia})`
        : `Importado do cronograma — UID Recurso: ${uids}; Família: ${b.familia}`;

    rows.push({
      atividade_id: b.atividade_ref.id,
      tipo_recurso: b.tipo,
      funcao_id: null,
      tipo_equipamento_id: null,
      descricao: b.descricao,
      unidade: b.unidade,
      quantidade_prevista: qtd,
      horas_previstas: horas,
      dias_previstos: dias,
      observacao,
      grupo: "INSUMOS",
      familia: b.familia,
      atividade_uid_externo: b.atividade_ref.uidTarefa,
      recurso_uid_externo: b.recurso_uid_externo,
      data_necessaria_inicio: b.atividade_ref.data_inicio,
      data_necessaria_fim: b.atividade_ref.data_fim,
      status_origem: "planejado",
    });
  }

  return { rows, pendencias };
}
