// Fase 6F / 6H.1.1 — Hook de importação de planejamento.
// Cria rascunho + atividades + (se houver aba Alocações) recursos planejados de mão de obra.
// SuperAdm only. Falha em recursos = importação parcial: atividades permanecem.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  criarPlanejamentoObra,
  excluirPlanejamentoObra,
  inserirAtividadesPlanejamento,
  obterProximaVersaoPlanejamento,
  SemPermissaoError,
  type PlanejamentoObraRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";
import {
  resolverFuncoesPorNomes,
  inserirRecursosPlanejadosLote,
  type RecursoPlanejadoInsert,
} from "@/services/planejamentoMacro/recursosPlanejadosService";
import { aplicarResolucaoFuncoes } from "@/lib/planejamentoMacro/importarCronograma/parseAlocacoes";
import {
  consolidarRecursosNaoMaoObra,
  type AtividadeRef,
} from "@/lib/planejamentoMacro/importarCronograma/consolidarRecursosNaoMaoObra";
import { useAuthPermissionsStable } from "@/hooks/useAuthPermissionsStable";
import type {
  AtividadeParaInserir,
  AlocacaoPreview,
  ResultadoParse,
} from "@/lib/planejamentoMacro/importarCronograma/tipos";

export interface ImportarPlanejamentoInput {
  centro_custo_id: string;
  resultado: ResultadoParse;
}

export interface ImportarPlanejamentoOutput {
  planejamento: PlanejamentoObraRow;
  atividadesInseridas: number;
  recursosInseridos: number;
  recursosConsolidados: number;
  /** 6I.2-C — telemetria detalhada da persistência ampliada. */
  recursosInseridosPorTipo: Record<string, number>;
  pendenciasEqSemUid: number;
  pendenciasMatSemUnidade: number;
  faturamentoBloqueado: number;
}


/** Erro específico: atividades importadas, recursos falharam. */
export class RecursosImportacaoParcialError extends Error {
  constructor(
    public planejamentoId: string,
    public atividadesInseridas: number,
    public causa: string
  ) {
    super(
      "Atividades importadas, mas houve falha ao importar recursos planejados. Esta versão ficou parcial. Revise ou exclua o rascunho e tente importar novamente."
    );
    this.name = "RecursosImportacaoParcialError";
  }
}

interface RecursoConsolidado {
  atividade_id: string;
  funcao_id: string;
  descricao: string;
  horas_previstas: number | null;
  dias_previstos: number | null;
  quantidade_prevista: number;
  unidade: string;
  observacao: string;
  origens: AlocacaoPreview[];
}

function consolidarAlocacoes(
  alocacoes: AlocacaoPreview[],
  mapLinhaParaAtividadeId: Map<number, string>
): { rows: RecursoConsolidado[]; consolidacoes: number } {
  const bucket = new Map<string, RecursoConsolidado>();

  for (const a of alocacoes) {
    if (a.motivoIgnorado !== null) continue;
    if (!a.funcaoId || !a.funcaoNomeResolvido) continue;
    if (a.vinculoAtividadeLinha === null) continue;
    const atividade_id = mapLinhaParaAtividadeId.get(a.vinculoAtividadeLinha);
    if (!atividade_id) continue;

    const key = `${atividade_id}|${a.funcaoId}`;
    let r = bucket.get(key);
    if (!r) {
      r = {
        atividade_id,
        funcao_id: a.funcaoId,
        descricao: a.funcaoNomeResolvido,
        horas_previstas: null,
        dias_previstos: null,
        quantidade_prevista: 0,
        unidade: "h",
        observacao: "",
        origens: [],
      };
      bucket.set(key, r);
    }
    r.origens.push(a);
  }

  let consolidacoes = 0;
  const rows: RecursoConsolidado[] = [];
  for (const r of bucket.values()) {
    let somaHoras: number | null = null;
    let somaUnidades = 0;
    const uids: string[] = [];

    for (const o of r.origens) {
      if (o.trabalhoHoras !== null && Number.isFinite(o.trabalhoHoras)) {
        somaHoras = (somaHoras ?? 0) + Number(o.trabalhoHoras);
      }
      if (o.unidades !== null && Number.isFinite(o.unidades) && Number(o.unidades) > 0) {
        somaUnidades += Number(o.unidades);
      } else {
        somaUnidades += 1; // fallback por item inválido
      }
      uids.push(o.uidRecurso ?? "?");
    }

    r.horas_previstas = somaHoras;
    r.dias_previstos =
      somaHoras !== null && somaHoras > 0 ? Number((somaHoras / 8).toFixed(4)) : null;
    r.quantidade_prevista = Math.max(1, Number(somaUnidades.toFixed(4)));

    const familia = r.origens[0]?.familia ?? "MOD";
    if (r.origens.length > 1) {
      consolidacoes += 1;
      r.observacao = `Importado do cronograma — consolidado de ${r.origens.length} alocações (UIDs Recurso: ${uids.join(", ")}; Família: ${familia})`;
    } else {
      r.observacao = `Importado do cronograma — UID Recurso: ${uids[0]}; Família: ${familia}`;
    }
    rows.push(r);
  }

  return { rows, consolidacoes };
}

export function useImportarPlanejamentoObra() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuthPermissionsStable();

  return useMutation<ImportarPlanejamentoOutput, Error, ImportarPlanejamentoInput>({
    mutationFn: async ({ centro_custo_id, resultado }) => {
      if (!isSuperAdmin) throw new SemPermissaoError();
      if (resultado.bloqueado) {
        throw new Error(resultado.motivoBloqueio ?? "Importação bloqueada.");
      }

      const atividades: AtividadeParaInserir[] = resultado.atividades
        .filter((a) => !a.ignored && a.errors.length === 0 && a.data_inicio && a.data_fim)
        .map((a) => ({
          linhaOriginal: a.linhaOriginal,
          codigo_wbs: a.codigo_wbs,
          nome: a.nome,
          descricao: a.descricao,
          frente_servico: a.frente_servico,
          data_inicio: a.data_inicio as string,
          data_fim: a.data_fim as string,
          unidade: a.unidade,
          quantidade_prevista: a.quantidade_prevista,
          producao_prevista: a.producao_prevista,
          prioridade: a.prioridade,
          status: "planejada",
          ordem_execucao: a.ordem_execucao,
          // 7A — enriquecimentos MS Project (filtrados por whitelist no service).
          uid_externo: a.uidTarefa,
          id_externo: a.idTarefa,
          outline_number: a.outline_number ?? null,
          outline_level: a.outline_level ?? null,
          duracao_horas: a.duracao_horas ?? null,
          trabalho_previsto_horas: a.trabalho_previsto_horas ?? null,
          is_resumo: a.is_resumo ?? false,
          is_marco: a.is_marco ?? false,
          arquivo_origem_nome: resultado.nomeArquivo,
        }));

      if (!atividades.length) {
        throw new Error("Nenhuma atividade válida para importar.");
      }

      const periodo_inicio =
        resultado.periodo.inicio ??
        atividades.reduce<string>(
          (acc, a) => (acc && acc < a.data_inicio ? acc : a.data_inicio),
          atividades[0].data_inicio
        );
      const periodo_fim =
        resultado.periodo.fim ??
        atividades.reduce<string>(
          (acc, a) => (acc && acc > a.data_fim ? acc : a.data_fim),
          atividades[0].data_fim
        );

      const versao = await obterProximaVersaoPlanejamento(centro_custo_id);

      const planejamento = await criarPlanejamentoObra({
        centro_custo_id,
        periodo_inicio,
        periodo_fim,
        versao,
        status: "rascunho",
        origem: resultado.origem,
        observacao: `Importado de "${resultado.nomeArquivo}" em ${new Date().toISOString()}`,
      });

      // Insert atividades (com compensação em caso de falha)
      let atividadesIds: string[] = [];
      let atividadesInseridas = 0;
      try {
        const out = await inserirAtividadesPlanejamento(planejamento.id, atividades);
        atividadesIds = out.ids;
        atividadesInseridas = out.inseridas;
      } catch (err) {
        try {
          await excluirPlanejamentoObra(planejamento.id);
          throw new Error(
            "Falha ao importar atividades. O rascunho foi removido. Tente novamente."
          );
        } catch (delErr) {
          if (delErr instanceof Error && delErr.message.startsWith("Falha ao importar")) {
            throw delErr;
          }
          qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", centro_custo_id] });
          throw new Error(
            `Falha ao importar atividades e ao remover o rascunho parcial (id: ${planejamento.id}). Acesse a lista de planejamentos deste CC e exclua manualmente o rascunho.`
          );
        }
      }

      // ---------- Recursos (6H.1.1 + 6I.2-C ampliado) ----------
      let recursosInseridos = 0;
      let recursosConsolidados = 0;
      const recursosInseridosPorTipo: Record<string, number> = {
        mao_obra: 0,
        equipamento: 0,
        material: 0,
        subempreiteiro: 0,
        administrativo: 0,
      };
      let pendenciasEqSemUid = 0;
      let pendenciasMatSemUnidade = 0;
      let faturamentoBloqueado = 0;

      if (resultado.alocacoes.length > 0 && resultado.recursos) {
        try {
          // Mapa linhaOriginal → atividade_id (positional) e atividade_ref completa
          const mapLinhaParaId = new Map<number, string>();
          const mapLinhaParaAtividade = new Map<number, AtividadeRef>();
          atividades.forEach((a, i) => {
            const id = atividadesIds[i];
            if (!id) return;
            mapLinhaParaId.set(a.linhaOriginal, id);
            // Buscar UID externo da atividade no resultado (preview)
            const ativPreview = resultado.atividades.find(
              (x) => x.linhaOriginal === a.linhaOriginal
            );
            mapLinhaParaAtividade.set(a.linhaOriginal, {
              id,
              data_inicio: a.data_inicio,
              data_fim: a.data_fim,
              uidTarefa: ativPreview?.uidTarefa ?? null,
            });
          });

          // (Re)resolver funções no momento da gravação (consistência)
          const nomesUnicos = Array.from(
            new Set(
              resultado.alocacoes
                .filter(
                  (a) =>
                    (a.familia === "MOD" || a.familia === "MOI") &&
                    a.vinculoAtividadeLinha !== null &&
                    a.nomeRecurso
                )
                .map((a) => a.nomeRecurso as string)
            )
          );
          const funcoesMap = await resolverFuncoesPorNomes(nomesUnicos);
          aplicarResolucaoFuncoes(resultado.alocacoes, resultado.recursos, funcoesMap);

          // ---- MOD/MOI (mão de obra) ----
          const { rows, consolidacoes } = consolidarAlocacoes(
            resultado.alocacoes,
            mapLinhaParaId
          );
          recursosConsolidados = consolidacoes;

          if (rows.length > 0) {
            const insertsMO: RecursoPlanejadoInsert[] = [];
            for (const r of rows) {
              const origem0 = r.origens[0];
              // Assert anti-FATURAMENTO (segurança extra)
              if (origem0 && origem0.grupo !== "INSUMOS") {
                faturamentoBloqueado += 1;
                continue;
              }
              const ativRef = mapLinhaParaAtividade.get(
                origem0?.vinculoAtividadeLinha ?? -1
              );
              insertsMO.push({
                planejamento_id: planejamento.id,
                atividade_id: r.atividade_id,
                tipo_recurso: "mao_obra",
                funcao_id: r.funcao_id,
                tipo_equipamento_id: null,
                descricao: r.descricao,
                unidade: r.unidade,
                quantidade_prevista: r.quantidade_prevista,
                horas_previstas: r.horas_previstas,
                dias_previstos: r.dias_previstos,
                observacao: r.observacao,
                grupo: "INSUMOS",
                familia: origem0?.familiaEfetiva ?? "MOD",
                atividade_uid_externo: ativRef?.uidTarefa ?? null,
                recurso_uid_externo: origem0?.uidRecurso ?? null,
                data_necessaria_inicio: ativRef?.data_inicio ?? null,
                data_necessaria_fim: ativRef?.data_fim ?? null,
                status_origem: "planejado",
              });
            }
            if (insertsMO.length > 0) {
              const ins = await inserirRecursosPlanejadosLote(insertsMO);
              recursosInseridos += ins;
              recursosInseridosPorTipo.mao_obra += ins;
            }
          }

          // ---- EQ / SUB / ADM / ADM_CONTRATUAL ----
          const { rows: rowsNaoMO, pendencias: pendNaoMO } =
            consolidarRecursosNaoMaoObra(resultado.alocacoes, mapLinhaParaAtividade);

          pendenciasEqSemUid = pendNaoMO.eqSemUid.length;
          pendenciasMatSemUnidade = pendNaoMO.matSemUnidade.length;

          if (rowsNaoMO.length > 0) {
            // Assert anti-FATURAMENTO (segurança extra)
            const seguros = rowsNaoMO.filter((r) => {
              if (r.grupo !== "INSUMOS") {
                faturamentoBloqueado += 1;
                return false;
              }
              return true;
            });

            const insertsNaoMO: RecursoPlanejadoInsert[] = seguros.map((r) => ({
              planejamento_id: planejamento.id,
              atividade_id: r.atividade_id,
              tipo_recurso: r.tipo_recurso,
              funcao_id: r.funcao_id,
              tipo_equipamento_id: r.tipo_equipamento_id,
              descricao: r.descricao,
              unidade: r.unidade,
              quantidade_prevista: r.quantidade_prevista,
              horas_previstas: r.horas_previstas,
              dias_previstos: r.dias_previstos,
              observacao: r.observacao,
              grupo: r.grupo,
              familia: r.familia,
              atividade_uid_externo: r.atividade_uid_externo,
              recurso_uid_externo: r.recurso_uid_externo,
              data_necessaria_inicio: r.data_necessaria_inicio,
              data_necessaria_fim: r.data_necessaria_fim,
              status_origem: r.status_origem,
            }));

            if (insertsNaoMO.length > 0) {
              const ins = await inserirRecursosPlanejadosLote(insertsNaoMO);
              recursosInseridos += ins;
              // contabiliza por tipo
              for (const r of seguros) {
                recursosInseridosPorTipo[r.tipo_recurso] =
                  (recursosInseridosPorTipo[r.tipo_recurso] ?? 0) + 1;
              }
            }
          }

          // Anota telemetria no próprio resumo (best-effort)
          if (resultado.recursos) {
            resultado.recursos.persistidosPorFamilia = { ...recursosInseridosPorTipo };
            resultado.recursos.pendencias = {
              eqSemUid: pendNaoMO.eqSemUid,
              matSemUnidade: pendNaoMO.matSemUnidade,
              faturamentoBloqueado,
            };
          }
        } catch (err) {
          const causa = err instanceof Error ? err.message : String(err);
          throw new RecursosImportacaoParcialError(
            planejamento.id,
            atividadesInseridas,
            causa
          );
        }
      }

      return {
        planejamento,
        atividadesInseridas,
        recursosInseridos,
        recursosConsolidados,
        recursosInseridosPorTipo,
        pendenciasEqSemUid,
        pendenciasMatSemUnidade,
        faturamentoBloqueado,
      };
    },

    onSuccess: (out, vars) => {
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente", vars.centro_custo_id] });
      qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", vars.centro_custo_id] });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      qc.invalidateQueries({ queryKey: ["recursos-planejamento"] });
      qc.invalidateQueries({ queryKey: ["contagem-recursos-planejamento"] });
      const t = out.recursosInseridosPorTipo;
      const partes: string[] = [];
      if (t.mao_obra > 0) partes.push(`${t.mao_obra} MO`);
      if (t.equipamento > 0) partes.push(`${t.equipamento} EQ`);
      if (t.material > 0) partes.push(`${t.material} MAT`);
      if (t.subempreiteiro > 0) partes.push(`${t.subempreiteiro} SUB`);
      if (t.administrativo > 0) partes.push(`${t.administrativo} ADM`);
      const sufixoRecursos =
        out.recursosInseridos > 0
          ? ` Recursos: ${partes.join(", ")}${
              out.recursosConsolidados > 0
                ? ` (${out.recursosConsolidados} consolidação(ões) MO)`
                : ""
            }.`
          : "";
      const sufixoPend: string[] = [];
      if (out.pendenciasEqSemUid > 0)
        sufixoPend.push(`${out.pendenciasEqSemUid} EQ sem UID`);
      if (out.pendenciasMatSemUnidade > 0)
        sufixoPend.push(`${out.pendenciasMatSemUnidade} MAT sem unidade`);
      if (out.faturamentoBloqueado > 0)
        sufixoPend.push(`${out.faturamentoBloqueado} FATURAMENTO bloqueados`);
      const sufixoPendenciasTxt =
        sufixoPend.length > 0 ? ` Pendências: ${sufixoPend.join(", ")}.` : "";
      toast.success(
        `Planejamento importado como rascunho — versão ${out.planejamento.versao}.${sufixoRecursos}${sufixoPendenciasTxt} Revise e ative quando estiver pronto.`
      );

    },
    onError: (err, vars) => {
      if (err instanceof SemPermissaoError) {
        toast.error("Apenas SuperAdm pode importar planejamento nesta fase.");
        return;
      }
      if (err instanceof RecursosImportacaoParcialError) {
        // Atividades persistem; force refresh para mostrar o rascunho.
        qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", vars.centro_custo_id] });
        qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
        toast.error(err.message, { duration: 12000 });
        return;
      }
      toast.error(err.message || "Erro ao importar planejamento.");
    },
  });
}
