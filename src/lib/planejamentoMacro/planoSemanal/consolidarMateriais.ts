// Fase 6J.1 — Consolidação semanal de materiais.
// Agrupa por (descricao normalizada, unidade). Nunca soma unidades diferentes.

import type {
  AtividadeBruta,
  LinhaMAT,
  Pendencia,
  RecursoBruto,
  SemanaRef,
} from "./tipos";
import { intersecao, listarDiasUteis, contarDiasUteis } from "./diasUteis";

export interface ResultadoMAT {
  linhas: LinhaMAT[];
  pendencias: Pendencia[];
}

export function consolidarMateriais(
  recursos: RecursoBruto[],
  atividadesById: Map<string, AtividadeBruta>,
  semana: SemanaRef
): ResultadoMAT {
  // por descrição: quais unidades aparecem
  const unidadesPorDescricao = new Map<string, Set<string>>();
  type Agg = {
    descricao: string;
    unidade: string;
    quantidadeSemana: number;
    atividades: Map<string, { wbs: string | null; nome: string }>;
  };
  const agg = new Map<string, Agg>();
  const pendencias: Pendencia[] = [];

  for (const r of recursos) {
    if (r.tipo_recurso !== "material") continue;
    const atividade = atividadesById.get(r.atividade_id);
    if (!atividade) continue;
    if (atividade.is_marco || atividade.is_resumo) continue;
    if (atividade.status === "cancelada") continue;

    const desc = (r.descricao || "").trim().toUpperCase();
    const unidade = (r.unidade || "").trim().toUpperCase() || "—";

    const setU = unidadesPorDescricao.get(desc) ?? new Set<string>();
    setU.add(unidade);
    unidadesPorDescricao.set(desc, setU);

    const janInicio = r.data_necessaria_inicio ?? atividade.data_inicio;
    const janFim = r.data_necessaria_fim ?? atividade.data_fim;
    if (!janInicio || !janFim || janFim < janInicio) continue;

    const diasJanela = contarDiasUteis(janInicio, janFim);
    if (diasJanela <= 0) continue;
    const inter = intersecao(janInicio, janFim, semana.inicio, semana.fim);
    if (!inter) continue;
    const diasInter = listarDiasUteis(inter.inicio, inter.fim).length;
    const fracao = diasInter / diasJanela;
    const qtdSemana = (r.quantidade_prevista || 0) * fracao;

    const chave = `${desc}|${unidade}`;
    let a = agg.get(chave);
    if (!a) {
      a = {
        descricao: r.descricao,
        unidade,
        quantidadeSemana: 0,
        atividades: new Map(),
      };
      agg.set(chave, a);
    }
    a.quantidadeSemana += qtdSemana;
    const key = `${atividade.codigo_wbs ?? ""}|${atividade.nome}`;
    if (!a.atividades.has(key)) {
      a.atividades.set(key, { wbs: atividade.codigo_wbs, nome: atividade.nome });
    }
  }

  const linhas: LinhaMAT[] = [];
  for (const [, a] of agg) {
    const setU = unidadesPorDescricao.get(a.descricao.trim().toUpperCase());
    const divergente = !!setU && setU.size > 1;
    linhas.push({
      descricao: a.descricao,
      unidade: a.unidade,
      quantidadeSemana: Math.round(a.quantidadeSemana * 1000) / 1000,
      unidadesDivergentes: divergente,
      atividades: Array.from(a.atividades.values()),
    });
    if (divergente) {
      pendencias.push({
        tipo: "unidade_divergente",
        descricao: `Material "${a.descricao}" aparece com unidades diferentes (${Array.from(
          setU!
        ).join(", ")}).`,
      });
    }
  }
  linhas.sort((x, y) => y.quantidadeSemana - x.quantidadeSemana);
  // dedup pendências unidade_divergente
  const seen = new Set<string>();
  const dedup = pendencias.filter((p) => {
    const k = `${p.tipo}|${p.descricao}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { linhas, pendencias: dedup };
}
