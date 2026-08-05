// Fase 6J.1 / 7A — Filtra atividades que cruzam a semana e calcula janela efetiva.
// 7A: aceita marcos (com flag); apenas resumos e canceladas ficam de fora.

import type { AtividadeBruta, AtividadeNaSemana, SemanaRef } from "./tipos";
import { contarDiasUteis, intersecao } from "./diasUteis";
import { classificarAtividadeNaSemana } from "./classificarAtividadeNaSemana";

export function filtrarAtividadesDaSemana(
  atividades: AtividadeBruta[],
  semana: SemanaRef,
): AtividadeNaSemana[] {
  const out: AtividadeNaSemana[] = [];
  for (const a of atividades) {
    if (a.is_resumo) continue;
    if (a.status === "cancelada") continue;
    if (!a.data_inicio || !a.data_fim) continue;
    if (a.data_fim < a.data_inicio) continue;

    // Marcos têm duração 0 e são válidos; apenas atividades comuns
    // exigem duração > 0.
    const dur = a.duracao_horas ?? 1;
    if (!a.is_marco && dur <= 0) continue;

    // Regra-mãe — interseção do período da atividade com a semana.
    if (a.data_inicio > semana.fim) continue;
    if (a.data_fim < semana.inicio) continue;

    const inter = intersecao(a.data_inicio, a.data_fim, semana.inicio, semana.fim);
    if (!inter) continue;

    const { flags, flagPrincipal } = classificarAtividadeNaSemana(a, semana);

    out.push({
      atividade: a,
      inicioNaSemana: inter.inicio,
      fimNaSemana: inter.fim,
      diasUteisNaSemana: contarDiasUteis(inter.inicio, inter.fim),
      flags,
      flagPrincipal,
    });
  }

  out.sort((x, y) => {
    const ox = x.atividade.outline_number ?? x.atividade.codigo_wbs ?? "";
    const oy = y.atividade.outline_number ?? y.atividade.codigo_wbs ?? "";
    if (ox !== oy) return ox.localeCompare(oy, "pt-BR", { numeric: true });
    return x.atividade.data_inicio.localeCompare(y.atividade.data_inicio);
  });
  return out;
}
