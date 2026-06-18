// Fase 6J.1 — Cálculo de demanda semanal de mão de obra.
// Distribuição uniforme por dias úteis da janela do recurso.
// Sem feriados nesta fase.

import {
  JORNADA_DIARIA_HORAS,
  type AtividadeBruta,
  type LinhaMO,
  type Pendencia,
  type RecursoBruto,
  type SemanaRef,
} from "./tipos";
import { contarDiasUteis, listarDiasUteis } from "./diasUteis";

interface Contribuicao {
  funcao: string;
  horasSemana: number;
  qtdPorDia: Map<string, number>; // dia ISO -> soma de quantidade do recurso cuja janela cobre o dia
  atividadeWbs: string | null;
  atividadeNome: string;
}

export interface ResultadoMO {
  linhas: LinhaMO[];
  pendencias: Pendencia[];
}

function normalizarFuncao(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

export function calcularDemandaMO(
  recursos: RecursoBruto[],
  atividadesById: Map<string, AtividadeBruta>,
  semana: SemanaRef,
  opts?: { jornada?: number }
): ResultadoMO {
  const jornada = opts?.jornada ?? JORNADA_DIARIA_HORAS;
  const diasUteisSemana = semana.diasUteis.length;
  const pendencias: Pendencia[] = [];
  const contribuicoes: Contribuicao[] = [];

  for (const r of recursos) {
    if (r.tipo_recurso !== "mao_obra") continue;
    const atividade = atividadesById.get(r.atividade_id);
    if (!atividade) continue;
    if (atividade.is_marco || atividade.is_resumo) continue;
    if (atividade.status === "cancelada") continue;

    const janInicio = r.data_necessaria_inicio ?? atividade.data_inicio;
    const janFim = r.data_necessaria_fim ?? atividade.data_fim;

    if (!janInicio || !janFim) {
      pendencias.push({
        tipo: "recurso_sem_data",
        descricao: `Recurso "${r.descricao}" da atividade "${atividade.nome}" sem datas definidas.`,
        atividadeId: atividade.id,
        recursoId: r.id,
      });
      continue;
    }
    if (janFim < janInicio) {
      pendencias.push({
        tipo: "atividade_sem_duracao",
        descricao: `Atividade "${atividade.nome}" tem data_fim anterior a data_inicio.`,
        atividadeId: atividade.id,
      });
      continue;
    }

    const diasJanela = contarDiasUteis(janInicio, janFim);
    if (diasJanela <= 0) continue;

    // Horas totais do recurso na janela.
    let horasTotais: number | null = null;
    if (r.horas_previstas != null && r.horas_previstas > 0) {
      horasTotais = r.horas_previstas;
    } else if (r.quantidade_prevista > 0) {
      horasTotais = r.quantidade_prevista * jornada * diasJanela;
    } else {
      pendencias.push({
        tipo: "recurso_sem_horas",
        descricao: `Recurso "${r.descricao}" sem horas previstas e sem quantidade.`,
        atividadeId: atividade.id,
        recursoId: r.id,
      });
      continue;
    }

    const horasPorDiaUtil = horasTotais / diasJanela;

    // Interseção da janela com a semana, dia a dia.
    const diasInter = listarDiasUteis(
      janInicio > semana.inicio ? janInicio : semana.inicio,
      janFim < semana.fim ? janFim : semana.fim
    );
    if (diasInter.length === 0) continue;

    const horasSemanaRec = horasPorDiaUtil * diasInter.length;
    const funcao = normalizarFuncao(r.descricao || "SEM FUNÇÃO");

    if (!r.descricao || r.descricao.trim() === "") {
      pendencias.push({
        tipo: "funcao_sem_mapeamento",
        descricao: `Recurso sem descrição/função na atividade "${atividade.nome}".`,
        atividadeId: atividade.id,
        recursoId: r.id,
      });
    }

    // Para pico diário: quantidade simultânea por dia.
    // Quantidade "estimada" do recurso no dia = horasPorDiaUtil/jornada.
    const qtdPorDiaRecurso = horasPorDiaUtil / jornada;
    const qtdPorDia = new Map<string, number>();
    for (const dia of diasInter) {
      qtdPorDia.set(dia, qtdPorDiaRecurso);
    }

    contribuicoes.push({
      funcao,
      horasSemana: horasSemanaRec,
      qtdPorDia,
      atividadeWbs: atividade.codigo_wbs,
      atividadeNome: atividade.nome,
    });
  }

  // Agregação por função.
  type Agg = {
    horasSemana: number;
    qtdPorDia: Map<string, number>;
    atividades: Map<string, { wbs: string | null; nome: string }>;
  };
  const agg = new Map<string, Agg>();
  for (const c of contribuicoes) {
    let a = agg.get(c.funcao);
    if (!a) {
      a = { horasSemana: 0, qtdPorDia: new Map(), atividades: new Map() };
      agg.set(c.funcao, a);
    }
    a.horasSemana += c.horasSemana;
    for (const [dia, q] of c.qtdPorDia) {
      a.qtdPorDia.set(dia, (a.qtdPorDia.get(dia) ?? 0) + q);
    }
    const key = `${c.atividadeWbs ?? ""}|${c.atividadeNome}`;
    if (!a.atividades.has(key)) {
      a.atividades.set(key, { wbs: c.atividadeWbs, nome: c.atividadeNome });
    }
  }

  const linhas: LinhaMO[] = [];
  for (const [funcao, a] of agg) {
    const horasSemana = a.horasSemana;
    const diasHomem = horasSemana / jornada;
    const denom = diasUteisSemana * jornada;
    const qtdEquivalente = denom > 0 ? horasSemana / denom : 0;
    let picoDiario = 0;
    for (const dia of semana.diasUteis) {
      const q = a.qtdPorDia.get(dia) ?? 0;
      if (q > picoDiario) picoDiario = q;
    }
    const qtdSugerida = Math.max(Math.ceil(qtdEquivalente), Math.ceil(picoDiario));
    linhas.push({
      funcao,
      horasSemana: round2(horasSemana),
      diasHomem: round2(diasHomem),
      qtdEquivalente: round2(qtdEquivalente),
      picoDiario: round2(picoDiario),
      qtdSugerida,
      // Fase 7B — Planejado (pico) em pessoas = teto do pico simultâneo.
      planejadoPico: Math.ceil(picoDiario),
      atividades: Array.from(a.atividades.values()),
    });
  }

  linhas.sort((x, y) => y.horasSemana - x.horasSemana);
  return { linhas, pendencias };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
