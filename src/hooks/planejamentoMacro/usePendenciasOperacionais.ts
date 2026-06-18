// Fase 7B — Pendências operacionais consolidadas.
// Apenas leitura/derivado a partir do planejamento vigente + catálogos.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  classificarRecurso,
  isClasseForaDoEscopoOperacional,
} from "@/lib/planejamentoMacro/planoSemanal/classificarRecurso";
import type {
  AtividadeBruta,
  Pendencia,
  RecursoBruto,
} from "@/lib/planejamentoMacro/planoSemanal/tipos";

const ATIVIDADE_COLS =
  "id, planejamento_id, codigo_wbs, outline_number, outline_level, nome, frente_servico, data_inicio, data_fim, status, is_marco, is_resumo, duracao_horas, quantidade_prevista, unidade";

const RECURSO_COLS =
  "id, planejamento_id, atividade_id, tipo_recurso, funcao_id, descricao, unidade, quantidade_prevista, horas_previstas, data_necessaria_inicio, data_necessaria_fim, grupo, familia";

interface Params {
  planejamentoId: string | null;
}

function normFn(s: string | null | undefined) {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function usePendenciasOperacionais({ planejamentoId }: Params) {
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

  const pendencias = useMemo<Pendencia[]>(() => {
    const recursos = recursosQ.data ?? [];
    const atividades = atividadesQ.data ?? [];
    const funcoes = funcoesQ.data ?? new Set<string>();
    const tiposEq = tiposEqQ.data ?? new Set<string>();
    const ativById = new Map(atividades.map((a) => [a.id, a]));

    const out: Pendencia[] = [];

    for (const r of recursos) {
      const ativ = ativById.get(r.atividade_id);
      const classe = classificarRecurso(r);

      // RECURSO_SEM_ATIVIDADE: atividade ausente, ou aponta a resumo/marco
      if (!ativ) {
        out.push({
          tipo: "RECURSO_SEM_ATIVIDADE",
          descricao: `Recurso "${r.descricao}" sem atividade válida vinculada.`,
          recursoId: r.id,
          item: r.descricao,
          familiaDetectada: r.familia ?? classe,
          acaoSugerida: "Reimportar planejamento ou revisar mapeamento de atividade.",
        });
        continue;
      }
      if (ativ.is_resumo || ativ.is_marco) {
        out.push({
          tipo: "RECURSO_SEM_ATIVIDADE",
          descricao: `Recurso "${r.descricao}" atribuído a tarefa resumo/marco "${ativ.nome}".`,
          recursoId: r.id,
          atividadeId: ativ.id,
          item: r.descricao,
          familiaDetectada: r.familia ?? classe,
          acaoSugerida: "Mover recurso para atividade executável (não resumo/marco).",
        });
        continue;
      }

      // FAMILIA_DESCONHECIDA
      if (classe === "DESCONHECIDA") {
        out.push({
          tipo: "FAMILIA_DESCONHECIDA",
          descricao: `Recurso "${r.descricao}" sem família reconhecida.`,
          recursoId: r.id,
          atividadeId: ativ.id,
          item: r.descricao,
          familiaDetectada: r.familia ?? null,
          acaoSugerida: "Classificar família (EQ/MOD/MOI/MAT) no cadastro de origem.",
        });
        continue;
      }

      // FORA_DO_ESCOPO_OPERACIONAL
      if (isClasseForaDoEscopoOperacional(classe)) {
        out.push({
          tipo: "FORA_DO_ESCOPO_OPERACIONAL",
          descricao: `Recurso "${r.descricao}" pertence a "${classe}" — não compõe demanda operacional.`,
          recursoId: r.id,
          atividadeId: ativ.id,
          item: r.descricao,
          familiaDetectada: classe,
          acaoSugerida: "Tratar via módulo administrativo/contratual correspondente.",
        });
        continue;
      }

      // FUNCAO_NAO_MAPEADA (MOD/MOI)
      if (classe === "MOD" || classe === "MOI") {
        const k = normFn(r.descricao);
        if (k && !funcoes.has(k)) {
          out.push({
            tipo: "FUNCAO_NAO_MAPEADA",
            descricao: `Função "${r.descricao}" não encontrada em bd_funcoes.`,
            recursoId: r.id,
            atividadeId: ativ.id,
            item: r.descricao,
            familiaDetectada: classe,
            acaoSugerida: "Cadastrar função em bd_funcoes ou criar alias.",
          });
        }
      }

      // EQUIPAMENTO_SEM_CATALOGO
      if (classe === "EQ") {
        const k = normFn(r.descricao);
        if (k && !tiposEq.has(k)) {
          out.push({
            tipo: "EQUIPAMENTO_SEM_CATALOGO",
            descricao: `Equipamento "${r.descricao}" sem correspondência no catálogo.`,
            recursoId: r.id,
            atividadeId: ativ.id,
            item: r.descricao,
            familiaDetectada: classe,
            acaoSugerida: "Cadastrar tipo de equipamento ou ajustar a descrição.",
          });
        }
      }

      // MATERIAL_SEM_UNIDADE
      if (classe === "MAT") {
        if (!r.unidade || r.unidade.trim() === "") {
          out.push({
            tipo: "MATERIAL_SEM_UNIDADE",
            descricao: `Material "${r.descricao}" sem unidade definida.`,
            recursoId: r.id,
            atividadeId: ativ.id,
            item: r.descricao,
            familiaDetectada: classe,
            acaoSugerida: "Definir unidade no cadastro do material.",
          });
        }
      }
    }

    return out;
  }, [recursosQ.data, atividadesQ.data, funcoesQ.data, tiposEqQ.data]);

  return {
    pendencias,
    isLoading:
      recursosQ.isLoading || atividadesQ.isLoading || funcoesQ.isLoading || tiposEqQ.isLoading,
    isError:
      recursosQ.isError || atividadesQ.isError || funcoesQ.isError || tiposEqQ.isError,
  };
}
