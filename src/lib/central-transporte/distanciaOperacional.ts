/**
 * CT-3D.1 — Regra de ajuste da distância operacional.
 *
 * Espelha exatamente `fn_ct_distancia_operacional` / `fn_ct_distancia_regra`:
 *  - até 28 km  → distância da rota, sem ajuste;
 *  - acima de 28 km → distância da rota + 25%.
 *
 * O servidor é a autoridade; aqui só antecipamos o mesmo número na UI.
 */

export const CT_DISTANCIA_LIMITE_KM = 28;
export const CT_DISTANCIA_FATOR = 1.25;

export type CtDistanciaRegra = "ATE_28KM_SEM_AJUSTE" | "ACIMA_28KM_MAIS_25PCT";

export const CT_DISTANCIA_REGRA_LABELS: Record<CtDistanciaRegra, string> = {
  ATE_28KM_SEM_AJUSTE: "Até 28 km — sem ajuste",
  ACIMA_28KM_MAIS_25PCT: "Acima de 28 km — acréscimo de 25%",
};

const arredonda = (n: number): number => Math.round(n * 10) / 10;

/** Distância operacional final (km) a partir da distância medida na rota. */
export const distanciaOperacional = (rotaKm: number | null): number | null => {
  if (rotaKm === null || !Number.isFinite(rotaKm)) return null;
  return rotaKm <= CT_DISTANCIA_LIMITE_KM
    ? arredonda(rotaKm)
    : arredonda(rotaKm * CT_DISTANCIA_FATOR);
};

/** Regra aplicada à distância da rota. */
export const distanciaRegra = (rotaKm: number | null): CtDistanciaRegra | null => {
  if (rotaKm === null || !Number.isFinite(rotaKm)) return null;
  return rotaKm <= CT_DISTANCIA_LIMITE_KM
    ? "ATE_28KM_SEM_AJUSTE"
    : "ACIMA_28KM_MAIS_25PCT";
};

/** Texto curto para exibição ("42 km · +25% → 52,5 km"). */
export const descreverDistancia = (rotaKm: number | null): string => {
  const op = distanciaOperacional(rotaKm);
  if (rotaKm === null || op === null) return "Rota não calculada";
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  return rotaKm <= CT_DISTANCIA_LIMITE_KM
    ? `${fmt(rotaKm)} km (sem ajuste)`
    : `${fmt(rotaKm)} km · +25% → ${fmt(op)} km`;
};

export default distanciaOperacional;
