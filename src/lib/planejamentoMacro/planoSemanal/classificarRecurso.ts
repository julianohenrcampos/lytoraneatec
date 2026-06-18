// Fase 7B — Helper de classificação operacional de recursos e atividades.
// Apenas leitura/derivado. Decide o que entra em cada aba operacional e o que
// vai para pendências (FORA_DO_ESCOPO_OPERACIONAL).

import type { AtividadeBruta, RecursoBruto } from "./tipos";

export type ClasseRecurso =
  | "EQ"
  | "MOD"
  | "MOI"
  | "MAT"
  | "SUB"
  | "ADM"
  | "ADM_CONTRATUAL"
  | "FATURAMENTO"
  | "DESCONHECIDA";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase();
}

export function classificarRecurso(r: RecursoBruto): ClasseRecurso {
  const familia = norm(r.familia);
  if (familia === "EQ") return "EQ";
  if (familia === "MOD") return "MOD";
  if (familia === "MOI") return "MOI";
  if (familia === "MAT") return "MAT";
  if (familia === "SUB") return "SUB";
  if (familia === "ADM_CONTRATUAL") return "ADM_CONTRATUAL";
  if (familia === "ADM") return "ADM";
  if (familia === "FATURAMENTO") return "FATURAMENTO";

  // Fallback pelo tipo_recurso (compatibilidade com dados antigos sem familia).
  const tipo = norm(r.tipo_recurso);
  if (tipo === "EQUIPAMENTO") return "EQ";
  if (tipo === "MAO_OBRA") return "MOD";
  if (tipo === "MATERIAL") return "MAT";
  if (tipo === "SUBEMPREITEIRO") return "SUB";
  if (tipo === "ADMINISTRATIVO") return "ADM";
  return "DESCONHECIDA";
}

export function isEquipamentoOperacional(r: RecursoBruto): boolean {
  return norm(r.tipo_recurso) === "EQUIPAMENTO" && norm(r.familia) === "EQ";
}

export function isMaoDeObraOperacional(r: RecursoBruto): boolean {
  if (norm(r.tipo_recurso) !== "MAO_OBRA") return false;
  const c = classificarRecurso(r);
  return c === "MOD" || c === "MOI";
}

export function isMaterialOperacional(r: RecursoBruto): boolean {
  return norm(r.tipo_recurso) === "MATERIAL" && classificarRecurso(r) === "MAT";
}

/**
 * Atividade utilizável como base de cálculo operacional.
 * Exclui resumos, marcos, canceladas. Linhas ignoradas pelo parser não chegam
 * até aqui pois não são persistidas em bd_planejamento_atividades.
 */
export function isAtividadeOperacional(a: AtividadeBruta): boolean {
  if (!a) return false;
  if (a.is_marco) return false;
  if (a.is_resumo) return false;
  if ((a.status ?? "").toLowerCase() === "cancelada") return false;
  return true;
}

export function isClasseForaDoEscopoOperacional(c: ClasseRecurso): boolean {
  return c === "ADM" || c === "ADM_CONTRATUAL" || c === "FATURAMENTO" || c === "SUB";
}
