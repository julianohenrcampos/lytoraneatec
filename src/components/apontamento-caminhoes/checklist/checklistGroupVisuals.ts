// Mapa único de identidade visual dos grupos do checklist C&E.
// Frontend-only. Não referenciado pelo backend/catálogo.

import {
  Settings,
  Droplets,
  CircleAlert,
  CircleGauge,
  Lightbulb,
  Armchair,
  Truck,
  Container,
  Navigation,
  ShieldCheck,
  ClipboardList,
  Zap,
  Construction,
  type LucideIcon,
} from "lucide-react";

export type ChecklistGrupoIconKey =
  | "motor"
  | "hidraulico"
  | "freios"
  | "pneus"
  | "iluminacao"
  | "cabine"
  | "cacamba"
  | "carroceria"
  | "geral"
  | "direcao"
  | "seguranca"
  | "estrutura"
  | "rodagem"
  | "eletrico"
  | "rolo"
  | "lamina"
  | "eixos"
  | "carregadeira"
  | "retroescavadeira";

export interface GrupoVisual {
  icon: LucideIcon;
  iconClassName: string;
  iconContainerClassName: string;
  borderClassName: string;
  headerClassName: string;
}

const V = (
  icon: LucideIcon,
  cor: {
    text: string;
    bg: string;
    border: string;
    header: string;
  }
): GrupoVisual => ({
  icon,
  iconClassName: cor.text,
  iconContainerClassName: `rounded-md p-1.5 ${cor.bg}`,
  borderClassName: `border-l-4 ${cor.border}`,
  headerClassName: cor.header,
});

export const CHECKLIST_GROUP_VISUALS: Record<ChecklistGrupoIconKey, GrupoVisual> = {
  motor: V(Settings, {
    text: "text-blue-700",
    bg: "bg-blue-100",
    border: "border-l-blue-500",
    header: "bg-blue-50/50",
  }),
  hidraulico: V(Droplets, {
    text: "text-cyan-700",
    bg: "bg-cyan-100",
    border: "border-l-cyan-500",
    header: "bg-cyan-50/50",
  }),
  freios: V(CircleAlert, {
    text: "text-red-700",
    bg: "bg-red-100",
    border: "border-l-red-500",
    header: "bg-red-50/50",
  }),
  pneus: V(CircleGauge, {
    text: "text-slate-700",
    bg: "bg-slate-200",
    border: "border-l-slate-500",
    header: "bg-slate-50",
  }),
  iluminacao: V(Lightbulb, {
    text: "text-orange-700",
    bg: "bg-orange-100",
    border: "border-l-orange-500",
    header: "bg-orange-50/50",
  }),
  cabine: V(Armchair, {
    text: "text-purple-700",
    bg: "bg-purple-100",
    border: "border-l-purple-500",
    header: "bg-purple-50/50",
  }),
  cacamba: V(Truck, {
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-l-amber-500",
    header: "bg-amber-50/50",
  }),
  carroceria: V(Container, {
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-l-amber-500",
    header: "bg-amber-50/50",
  }),
  geral: V(ClipboardList, {
    text: "text-indigo-700",
    bg: "bg-indigo-100",
    border: "border-l-indigo-500",
    header: "bg-indigo-50/50",
  }),
  direcao: V(Navigation, {
    text: "text-teal-700",
    bg: "bg-teal-100",
    border: "border-l-teal-500",
    header: "bg-teal-50/50",
  }),
  seguranca: V(ShieldCheck, {
    text: "text-emerald-700",
    bg: "bg-emerald-100",
    border: "border-l-emerald-500",
    header: "bg-emerald-50/50",
  }),
  estrutura: V(Construction, {
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-l-amber-500",
    header: "bg-amber-50/50",
  }),
  rodagem: V(CircleGauge, {
    text: "text-slate-700",
    bg: "bg-slate-200",
    border: "border-l-slate-500",
    header: "bg-slate-50",
  }),
  eletrico: V(Zap, {
    text: "text-yellow-700",
    bg: "bg-yellow-100",
    border: "border-l-yellow-500",
    header: "bg-yellow-50/50",
  }),
  rolo: V(CircleGauge, {
    text: "text-slate-700",
    bg: "bg-slate-200",
    border: "border-l-slate-500",
    header: "bg-slate-50",
  }),
  lamina: V(Construction, {
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-l-amber-500",
    header: "bg-amber-50/50",
  }),
  eixos: V(Settings, {
    text: "text-slate-700",
    bg: "bg-slate-200",
    border: "border-l-slate-500",
    header: "bg-slate-50",
  }),
  carregadeira: V(Container, {
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-l-amber-500",
    header: "bg-amber-50/50",
  }),
  retroescavadeira: V(Construction, {
    text: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-l-amber-500",
    header: "bg-amber-50/50",
  }),
};

const FALLBACK: GrupoVisual = CHECKLIST_GROUP_VISUALS.geral;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolve o visual pela chave do ícone (preferencial) ou por normalização do título.
 */
export function resolverGrupoVisual(codigoOuTitulo?: string | null): GrupoVisual {
  if (!codigoOuTitulo) return FALLBACK;
  const key = normalize(codigoOuTitulo);
  if ((CHECKLIST_GROUP_VISUALS as Record<string, GrupoVisual>)[key]) {
    return (CHECKLIST_GROUP_VISUALS as Record<string, GrupoVisual>)[key];
  }
  // heurística por título contendo palavras conhecidas
  const rules: Array<[RegExp, ChecklistGrupoIconKey]> = [
    [/motor/, "motor"],
    [/hidr/, "hidraulico"],
    [/freio/, "freios"],
    [/pneu|roda/, "pneus"],
    [/ilumin|sinaliz/, "iluminacao"],
    [/cabine/, "cabine"],
    [/cacamba|caçamba/, "cacamba"],
    [/carroceria/, "carroceria"],
    [/dire[cç]/, "direcao"],
    [/segur/, "seguranca"],
    [/estrutura/, "estrutura"],
    [/rodagem|esteira/, "rodagem"],
    [/el[eé]tric/, "eletrico"],
    [/rolo/, "rolo"],
    [/lamina|lâmina/, "lamina"],
    [/eixo/, "eixos"],
    [/carregadeira/, "carregadeira"],
    [/retro/, "retroescavadeira"],
    [/geral/, "geral"],
  ];
  for (const [rx, k] of rules) if (rx.test(key)) return CHECKLIST_GROUP_VISUALS[k];
  return FALLBACK;
}
