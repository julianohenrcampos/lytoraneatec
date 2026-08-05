// Fase 7B — Demanda semanal de EQUIPAMENTOS OPERACIONAIS.
// Apenas recursos com tipo_recurso="equipamento" E familia normalizada="EQ".
// SUB / ADM / ADM_CONTRATUAL / FATURAMENTO não entram aqui — vão para
// Pendências (FORA_DO_ESCOPO_OPERACIONAL).

import type {
  AtividadeBruta,
  LinhaEQ,
  RecursoBruto,
  SemanaRef,
} from "./tipos";
import { intersecao, listarDiasUteis } from "./diasUteis";
import { isAtividadeOperacional, isEquipamentoOperacional } from "./classificarRecurso";

export function calcularDemandaEquipamentos(
  recursos: RecursoBruto[],
  atividadesById: Map<string, AtividadeBruta>,
  semana: SemanaRef
): LinhaEQ[] {
  type Agg = {
    grupo: string | null;
    familia: string | null;
    descricao: string;
    unidade: string | null;
    qtdPorDia: Map<string, number>;
    inicio: string;
    fim: string;
    atividades: Map<string, { wbs: string | null; nome: string }>;
  };
  const agg = new Map<string, Agg>();

  for (const r of recursos) {
    if (!isEquipamentoOperacional(r)) continue;
    const atividade = atividadesById.get(r.atividade_id);
    if (!atividade) continue;
    if (!isAtividadeOperacional(atividade)) continue;

    const janInicio = r.data_necessaria_inicio ?? atividade.data_inicio;
    const janFim = r.data_necessaria_fim ?? atividade.data_fim;
    if (!janInicio || !janFim || janFim < janInicio) continue;

    const inter = intersecao(janInicio, janFim, semana.inicio, semana.fim);
    if (!inter) continue;
    const diasInter = listarDiasUteis(inter.inicio, inter.fim);
    if (diasInter.length === 0) continue;

    const descNorm = (r.descricao || "").trim().toUpperCase();
    const chave = `equipamento|${r.grupo ?? ""}|${r.familia ?? ""}|${descNorm}`;
    let a = agg.get(chave);
    if (!a) {
      a = {
        grupo: r.grupo,
        familia: r.familia,
        descricao: r.descricao,
        unidade: r.unidade,
        qtdPorDia: new Map(),
        inicio: inter.inicio,
        fim: inter.fim,
        atividades: new Map(),
      };
      agg.set(chave, a);
    }
    if (inter.inicio < a.inicio) a.inicio = inter.inicio;
    if (inter.fim > a.fim) a.fim = inter.fim;
    for (const dia of diasInter) {
      a.qtdPorDia.set(dia, (a.qtdPorDia.get(dia) ?? 0) + (r.quantidade_prevista || 0));
    }
    const key = `${atividade.codigo_wbs ?? ""}|${atividade.nome}`;
    if (!a.atividades.has(key)) {
      a.atividades.set(key, { wbs: atividade.codigo_wbs, nome: atividade.nome });
    }
  }

  const linhas: LinhaEQ[] = [];
  for (const [chave, a] of agg) {
    let pico = 0;
    for (const dia of semana.diasUteis) {
      const q = a.qtdPorDia.get(dia) ?? 0;
      if (q > pico) pico = q;
    }
    linhas.push({
      chave,
      tipo: "equipamento",
      grupo: a.grupo,
      familia: a.familia,
      descricao: a.descricao,
      unidade: a.unidade,
      picoSemana: Math.round(pico * 100) / 100,
      inicioNecessario: a.inicio,
      fimNecessario: a.fim,
      atividades: Array.from(a.atividades.values()),
    });
  }
  linhas.sort((x, y) => y.picoSemana - x.picoSemana);
  return linhas;
}
