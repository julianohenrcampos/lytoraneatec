// Fase 7B — Pendências operacionais consolidadas.
// Fase 1C-2A — Rastreabilidade: enriquece pendências com metadados da atividade
// (EAP, período, status, criticidade, qtd/unidade/origem) e marca se a atividade
// cruza a semana ativa selecionada no Planejamento Semanal. Recalibra severidades.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  classificarRecurso,
  isClasseForaDoEscopoOperacional,
} from "@/lib/planejamentoMacro/planoSemanal/classificarRecurso";
import type {
  AtividadeBruta,
  GrupoPendencia,
  Pendencia,
  RecursoBruto,
  SemanaRef,
  SeveridadePendenciaOp,
  TipoPendencia,
} from "@/lib/planejamentoMacro/planoSemanal/tipos";

const ATIVIDADE_COLS =
  "id, planejamento_id, codigo_wbs, outline_number, outline_level, nome, frente_servico, data_inicio, data_fim, status, is_marco, is_resumo, is_critica, duracao_horas, quantidade_prevista, unidade, quantidade_origem";

const RECURSO_COLS =
  "id, planejamento_id, atividade_id, tipo_recurso, funcao_id, descricao, unidade, quantidade_prevista, horas_previstas, data_necessaria_inicio, data_necessaria_fim, grupo, familia";

interface Params {
  planejamentoId: string | null;
  /** Semana ativa do usuário (Planejamento Semanal). Fallback: hoje. */
  semanaReferencia?: SemanaRef | null;
}

function normFn(s: string | null | undefined) {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function grupoPorTipo(tipo: TipoPendencia, isCritica: boolean): GrupoPendencia {
  switch (tipo) {
    case "ATIVIDADE_CRITICA_SEM_EQUIPE":
      return "critica";
    case "ATIVIDADE_SEM_QUANTIDADE":
    case "ATIVIDADE_SEM_UNIDADE":
      return isCritica ? "critica" : "atividade";
    case "FUNCAO_NAO_MAPEADA":
      return "mao_obra";
    case "EQUIPAMENTO_SEM_CATALOGO":
      return "equipamento";
    case "MATERIAL_SEM_UNIDADE":
      return "material";
    case "FORA_DO_ESCOPO_OPERACIONAL":
      return "fora_escopo";
    case "RECURSO_SEM_ATIVIDADE":
    case "FAMILIA_DESCONHECIDA":
      return "outros";
    default:
      return "outros";
  }
}

function cruzaSemana(
  a: { data_inicio: string | null; data_fim: string | null },
  semana: SemanaRef | null | undefined
): boolean | undefined {
  if (!semana || !a.data_inicio || !a.data_fim) return undefined;
  return a.data_inicio <= semana.fim && a.data_fim >= semana.inicio;
}

export function usePendenciasOperacionais({
  planejamentoId,
  semanaReferencia = null,
}: Params) {
  const recursosQ = useQuery({
    queryKey: ["pendencias-op-recursos", planejamentoId],
    enabled: !!planejamentoId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecursoBruto[]> => {
      const { data, error } = await (supabase as any)
        .from("bd_planejamento_recursos")
        .select(RECURSO_COLS)
        .eq("planejamento_id", planejamentoId);
      if (error) throw error;
      return (data ?? []) as RecursoBruto[];
    },
  });

  const atividadesQ = useQuery({
    queryKey: ["pendencias-op-atividades", planejamentoId],
    enabled: !!planejamentoId,
    staleTime: 60_000,
    queryFn: async (): Promise<AtividadeBruta[]> => {
      const { data, error } = await (supabase as any)
        .from("bd_planejamento_atividades")
        .select(ATIVIDADE_COLS)
        .eq("planejamento_id", planejamentoId);
      if (error) throw error;
      return (data ?? []) as AtividadeBruta[];
    },
  });

  const funcoesQ = useQuery({
    queryKey: ["pendencias-op-funcoes"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await (supabase as any)
        .from("bd_funcoes")
        .select("nome_funcao");
      if (error) throw error;
      const s = new Set<string>();
      for (const r of (data ?? []) as any[]) {
        const k = normFn(r.nome_funcao);
        if (k) s.add(k);
      }
      return s;
    },
  });

  const tiposEqQ = useQuery({
    queryKey: ["pendencias-op-tipos-eq"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await (supabase as any)
        .from("bd_tipos_equipamento")
        .select("descricao_padronizada");
      if (error) throw error;
      const s = new Set<string>();
      for (const r of (data ?? []) as any[]) {
        const k = normFn(r.descricao_padronizada);
        if (k) s.add(k);
      }
      return s;
    },
  });

  const equipeQ = useQuery({
    queryKey: ["pendencias-op-equipe", planejamentoId],
    enabled: !!planejamentoId,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await (supabase as any)
        .from("bd_planejamento_atividade_equipe")
        .select("atividade_id, ativo")
        .eq("planejamento_id", planejamentoId);
      if (error) {
        const fb = await (supabase as any)
          .from("bd_planejamento_atividade_equipe")
          .select("atividade_id, ativo");
        if (fb.error) throw fb.error;
        const s = new Set<string>();
        for (const r of (fb.data ?? []) as any[]) {
          if (r.atividade_id && (r.ativo ?? true)) s.add(r.atividade_id as string);
        }
        return s;
      }
      const s = new Set<string>();
      for (const r of (data ?? []) as any[]) {
        if (r.atividade_id && (r.ativo ?? true)) s.add(r.atividade_id as string);
      }
      return s;
    },
  });

  const pendencias = useMemo<Pendencia[]>(() => {
    const recursos = recursosQ.data ?? [];
    const atividades = atividadesQ.data ?? [];
    const funcoes = funcoesQ.data ?? new Set<string>();
    const tiposEq = tiposEqQ.data ?? new Set<string>();
    const ativComEquipe = equipeQ.data ?? new Set<string>();
    const ativById = new Map(atividades.map((a) => [a.id, a]));

    const ativComRecursos = new Set<string>();
    for (const r of recursos) if (r.atividade_id) ativComRecursos.add(r.atividade_id);

    const enriquecer = (
      p: Pendencia,
      a: AtividadeBruta | undefined
    ): Pendencia => {
      const isCritica = Boolean(a?.is_critica);
      const grupo = grupoPorTipo(p.tipo, isCritica);
      const meta: Partial<Pendencia> = a
        ? {
            eap: a.codigo_wbs ?? null,
            periodoInicio: a.data_inicio ?? null,
            periodoFim: a.data_fim ?? null,
            statusAtividade: a.status ?? null,
            isCritica,
            quantidadePrevista: a.quantidade_prevista ?? null,
            unidade: a.unidade ?? null,
            quantidadeOrigem: a.quantidade_origem ?? null,
            dentroDaSemanaSelecionada: cruzaSemana(a, semanaReferencia),
          }
        : {};
      return { ...p, grupo, ...meta };
    };

    const out: Pendencia[] = [];

    for (const r of recursos) {
      const ativ = ativById.get(r.atividade_id);
      const classe = classificarRecurso(r);

      if (!ativ) {
        out.push(
          enriquecer(
            {
              tipo: "RECURSO_SEM_ATIVIDADE",
              descricao: `Recurso "${r.descricao}" sem atividade válida vinculada.`,
              recursoId: r.id,
              item: r.descricao,
              familiaDetectada: r.familia ?? classe,
              acaoSugerida: "Reimportar planejamento ou revisar mapeamento de atividade.",
              severidade: "critica",
            },
            undefined
          )
        );
        continue;
      }
      if (ativ.is_resumo || ativ.is_marco) {
        out.push(
          enriquecer(
            {
              tipo: "RECURSO_SEM_ATIVIDADE",
              descricao: `Recurso "${r.descricao}" atribuído a tarefa resumo/marco "${ativ.nome}".`,
              recursoId: r.id,
              atividadeId: ativ.id,
              item: r.descricao,
              familiaDetectada: r.familia ?? classe,
              acaoSugerida: "Mover recurso para atividade executável (não resumo/marco).",
              severidade: "critica",
            },
            ativ
          )
        );
        continue;
      }

      if (classe === "DESCONHECIDA") {
        out.push(
          enriquecer(
            {
              tipo: "FAMILIA_DESCONHECIDA",
              descricao: `Recurso "${r.descricao}" sem família reconhecida.`,
              recursoId: r.id,
              atividadeId: ativ.id,
              item: r.descricao,
              familiaDetectada: r.familia ?? null,
              acaoSugerida: "Classificar família (EQ/MOD/MOI/MAT) no cadastro de origem.",
              severidade: "critica",
            },
            ativ
          )
        );
        continue;
      }

      if (isClasseForaDoEscopoOperacional(classe)) {
        // 1C-2A — recurso administrativo/contratual: aviso, não crítica.
        out.push(
          enriquecer(
            {
              tipo: "FORA_DO_ESCOPO_OPERACIONAL",
              descricao: `Recurso "${r.descricao}" pertence a "${classe}" — não compõe demanda operacional.`,
              recursoId: r.id,
              atividadeId: ativ.id,
              item: r.descricao,
              familiaDetectada: classe,
              acaoSugerida: "Tratar via módulo administrativo/contratual correspondente.",
              severidade: "aviso",
            },
            ativ
          )
        );
        continue;
      }

      if (classe === "MOD" || classe === "MOI") {
        const k = normFn(r.descricao);
        if (k && !funcoes.has(k)) {
          out.push(
            enriquecer(
              {
                tipo: "FUNCAO_NAO_MAPEADA",
                descricao: `Função "${r.descricao}" não encontrada em bd_funcoes.`,
                recursoId: r.id,
                atividadeId: ativ.id,
                item: r.descricao,
                familiaDetectada: classe,
                acaoSugerida: "Cadastrar função em bd_funcoes ou criar alias.",
                severidade: "critica",
              },
              ativ
            )
          );
        }
      }

      if (classe === "EQ") {
        const k = normFn(r.descricao);
        if (k && !tiposEq.has(k)) {
          // 1C-2A — aviso por padrão; eleva a crítica se atividade crítica.
          const sev: SeveridadePendenciaOp = ativ.is_critica ? "critica" : "aviso";
          out.push(
            enriquecer(
              {
                tipo: "EQUIPAMENTO_SEM_CATALOGO",
                descricao: `Equipamento "${r.descricao}" sem correspondência no catálogo.`,
                recursoId: r.id,
                atividadeId: ativ.id,
                item: r.descricao,
                familiaDetectada: classe,
                acaoSugerida: "Cadastrar tipo de equipamento ou ajustar a descrição.",
                severidade: sev,
              },
              ativ
            )
          );
        }
      }

      if (classe === "MAT") {
        if (!r.unidade || r.unidade.trim() === "") {
          out.push(
            enriquecer(
              {
                tipo: "MATERIAL_SEM_UNIDADE",
                descricao: `Material "${r.descricao}" sem unidade definida.`,
                recursoId: r.id,
                atividadeId: ativ.id,
                item: r.descricao,
                familiaDetectada: classe,
                acaoSugerida: "Definir unidade no cadastro do material.",
                severidade: "critica",
              },
              ativ
            )
          );
        }
      }
    }

    for (const a of atividades) {
      if (a.is_resumo || a.is_marco) continue;
      if ((a.status ?? "").toLowerCase() === "cancelada") continue;

      const elevar = Boolean(a.is_critica) || ativComRecursos.has(a.id);

      if (a.quantidade_prevista == null) {
        out.push(
          enriquecer(
            {
              tipo: "ATIVIDADE_SEM_QUANTIDADE",
              descricao: `Atividade "${a.nome}" sem quantidade planejada.`,
              atividadeId: a.id,
              item: a.nome,
              acaoSugerida:
                "Informar quantidade na próxima importação ou corrigir manualmente.",
              severidade: elevar ? "critica" : "aviso",
            },
            a
          )
        );
      }
      if (!a.unidade || a.unidade.trim() === "") {
        out.push(
          enriquecer(
            {
              tipo: "ATIVIDADE_SEM_UNIDADE",
              descricao: `Atividade "${a.nome}" sem unidade de medida.`,
              atividadeId: a.id,
              item: a.nome,
              acaoSugerida:
                "Informar a unidade (m, m², m³, un...) na importação ou no cadastro da atividade.",
              severidade: elevar ? "critica" : "aviso",
            },
            a
          )
        );
      }
      if (a.is_critica && !ativComEquipe.has(a.id)) {
        out.push(
          enriquecer(
            {
              tipo: "ATIVIDADE_CRITICA_SEM_EQUIPE",
              descricao: `Atividade crítica "${a.nome}" sem equipe planejada.`,
              atividadeId: a.id,
              item: a.nome,
              acaoSugerida:
                "Vincular ao menos uma equipe/função à atividade crítica no Planejamento Semanal.",
              severidade: "critica",
            },
            a
          )
        );
      }
    }

    return out;
  }, [
    recursosQ.data,
    atividadesQ.data,
    funcoesQ.data,
    tiposEqQ.data,
    equipeQ.data,
    semanaReferencia,
  ]);

  return {
    pendencias,
    isLoading:
      recursosQ.isLoading ||
      atividadesQ.isLoading ||
      funcoesQ.isLoading ||
      tiposEqQ.isLoading ||
      equipeQ.isLoading,
    isError:
      recursosQ.isError ||
      atividadesQ.isError ||
      funcoesQ.isError ||
      tiposEqQ.isError ||
      equipeQ.isError,
  };
}
