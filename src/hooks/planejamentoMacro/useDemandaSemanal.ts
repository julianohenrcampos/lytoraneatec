// Fase 6J.1 — Hook orquestrador do Plano Semanal (read-only).
// Busca atividades + recursos do planejamento e deriva tudo em memória.

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularSemanaAtualBRT,
  calcularSemanaDaData,
  clampSemana,
  deslocarSemana,
} from "@/lib/planejamentoMacro/planoSemanal/calcularSemana";
import { filtrarAtividadesDaSemana } from "@/lib/planejamentoMacro/planoSemanal/filtrarAtividadesDaSemana";
import { calcularDemandaMO } from "@/lib/planejamentoMacro/planoSemanal/calcularDemandaMO";
import { calcularDemandaEquipamentos } from "@/lib/planejamentoMacro/planoSemanal/calcularDemandaEquipamentos";
import { consolidarMateriais } from "@/lib/planejamentoMacro/planoSemanal/consolidarMateriais";
import type {
  AtividadeBruta,
  Pendencia,
  RecursoBruto,
  SemanaRef,
} from "@/lib/planejamentoMacro/planoSemanal/tipos";

const ATIVIDADE_COLS =
  "id, planejamento_id, codigo_wbs, outline_number, outline_level, nome, frente_servico, data_inicio, data_fim, status, is_marco, is_resumo, duracao_horas, quantidade_prevista, unidade";

const RECURSO_COLS =
  "id, planejamento_id, atividade_id, tipo_recurso, funcao_id, descricao, unidade, quantidade_prevista, horas_previstas, data_necessaria_inicio, data_necessaria_fim, grupo, familia";

interface Params {
  planejamentoId: string | null;
  /** Fase 7B — limites da semana = período do planejamento vigente. */
  planInicio: string | null;
  planFim: string | null;
}

export function useDemandaSemanal({ planejamentoId, planInicio, planFim }: Params) {
  const [semana, setSemanaState] = useState<SemanaRef>(() => {
    // Inicializa preferindo o início do planejamento vigente, para que a
    // navegação semanal cubra todo o período (ex.: M102 — 22/04/2026).
    if (planInicio) {
      const base = calcularSemanaDaData(planInicio);
      if (planFim) return clampSemana(base, planInicio, planFim);
      return base;
    }
    return calcularSemanaAtualBRT();
  });

  const setSemana = useCallback(
    (s: SemanaRef) => {
      if (planInicio && planFim) {
        setSemanaState(clampSemana(s, planInicio, planFim));
      } else {
        setSemanaState(s);
      }
    },
    [planInicio, planFim]
  );


  const irPara = useCallback((iso: string) => setSemana(calcularSemanaDaData(iso)), [setSemana]);
  const semanaAtual = useCallback(() => setSemana(calcularSemanaAtualBRT()), [setSemana]);
  const proximaSemana = useCallback(() => setSemana(deslocarSemana(semana, 1)), [semana, setSemana]);
  const semanaAnterior = useCallback(() => setSemana(deslocarSemana(semana, -1)), [semana, setSemana]);

  const atividadesQuery = useQuery({
    queryKey: ["plano-semanal-atividades", planejamentoId],
    enabled: !!planejamentoId,
    staleTime: 30_000,
    queryFn: async (): Promise<AtividadeBruta[]> => {
      const { data, error } = await (supabase as any)
        .from("bd_planejamento_atividades")
        .select(ATIVIDADE_COLS)
        .eq("planejamento_id", planejamentoId)
        .order("outline_number", { ascending: true, nullsFirst: false })
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AtividadeBruta[];
    },
  });

  const recursosQuery = useQuery({
    queryKey: ["plano-semanal-recursos", planejamentoId],
    enabled: !!planejamentoId,
    staleTime: 30_000,
    queryFn: async (): Promise<RecursoBruto[]> => {
      const { data, error } = await (supabase as any)
        .from("bd_planejamento_recursos")
        .select(RECURSO_COLS)
        .eq("planejamento_id", planejamentoId);
      if (error) throw error;
      return (data ?? []) as RecursoBruto[];
    },
  });

  const atividades = atividadesQuery.data ?? [];
  const recursos = recursosQuery.data ?? [];

  const derivado = useMemo(() => {
    const atividadesById = new Map<string, AtividadeBruta>();
    for (const a of atividades) atividadesById.set(a.id, a);

    const atividadesSemana = filtrarAtividadesDaSemana(atividades, semana);
    const idsSemana = new Set(atividadesSemana.map((a) => a.atividade.id));
    const recursosSemana = recursos.filter((r) => idsSemana.has(r.atividade_id));

    const mo = calcularDemandaMO(recursosSemana, atividadesById, semana);
    const eq = calcularDemandaEquipamentos(recursosSemana, atividadesById, semana);
    const mat = consolidarMateriais(recursosSemana, atividadesById, semana);

    const pendencias: Pendencia[] = [...mo.pendencias, ...mat.pendencias];
    for (const a of atividadesSemana) {
      if (!a.atividade.duracao_horas || a.atividade.duracao_horas <= 0) {
        pendencias.push({
          tipo: "atividade_sem_duracao",
          descricao: `Atividade "${a.atividade.nome}" sem duração definida.`,
          atividadeId: a.atividade.id,
        });
      }
    }

    const frentes = new Set<string>();
    for (const a of atividadesSemana) {
      if (a.atividade.frente_servico) frentes.add(a.atividade.frente_servico);
    }

    return {
      atividadesSemana,
      demandaMO: mo.linhas,
      demandaEQ: eq,
      demandaMAT: mat.linhas,
      pendencias,
      frentes: Array.from(frentes),
    };
  }, [atividades, recursos, semana]);

  return {
    semana,
    setSemana,
    irPara,
    semanaAtual,
    proximaSemana,
    semanaAnterior,
    isLoading: atividadesQuery.isLoading || recursosQuery.isLoading,
    isError: atividadesQuery.isError || recursosQuery.isError,
    error: atividadesQuery.error ?? recursosQuery.error,
    ...derivado,
  };
}
