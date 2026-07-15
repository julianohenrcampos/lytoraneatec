import mapboxgl from "mapbox-gl";
import {
  STATUS_COLORS,
  type MapaOperacionalAtivo,
  type StatusMapa,
} from "@/services/mapa-operacional/mapaOperacionalService";

export interface MapaOpFeatureProps {
  equipamento_id: string;
  apontamento_id: string;
  status_mapa: StatusMapa;
  status_label: string;
  status_color: string;
  equipamento: string;
  frota: string;
  numero_frota: string;
  placa: string;
  centro_custo: string;
  operador: string;
  situacao_ui: string;
  data_registro: string;
  precisao_gps: number | null;
  horimetro_final: number | null;
  qtd_nao_ok: number;
}

export interface MapaOpFeature {
  type: "Feature";
  id: string;
  properties: MapaOpFeatureProps;
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface MapaOpFeatureCollection {
  type: "FeatureCollection";
  features: MapaOpFeature[];
}

export interface DescarteInfo {
  equipamento_id: string;
  motivo: string;
}

export interface BuildResult {
  featureCollection: MapaOpFeatureCollection;
  descartados: DescarteInfo[];
}

/**
 * Traduz "Disponível" (DB) para "À disposição" (UI). Nunca reclassifica como PARADO.
 */
export function traduzirSituacaoUI(situacao: string | null | undefined): string {
  if (!situacao) return "—";
  const s = situacao.trim();
  const norm = s.toLowerCase();
  if (norm === "disponível" || norm === "disponivel") return "À disposição";
  return s;
}

function coordInvalida(lat: unknown, lng: unknown): string | null {
  if (!Number.isFinite(lat as number)) return "latitude não numérica";
  if (!Number.isFinite(lng as number)) return "longitude não numérica";
  const la = lat as number;
  const lo = lng as number;
  if (la < -90 || la > 90) return "latitude fora de [-90,90]";
  if (lo < -180 || lo > 180) return "longitude fora de [-180,180]";
  if (la === 0 && lo === 0) return "coordenada 0,0";
  return null;
}

export function buildFeatureCollection(ativos: MapaOperacionalAtivo[]): BuildResult {
  const features: MapaOpFeature[] = [];
  const descartados: DescarteInfo[] = [];
  for (const a of ativos) {
    const motivo = coordInvalida(a.latitude, a.longitude);
    if (motivo) {
      descartados.push({ equipamento_id: a.equipamento_id, motivo });
      continue;
    }
    const status = STATUS_COLORS[a.status_mapa] ?? STATUS_COLORS.SEM_STATUS;
    features.push({
      type: "Feature",
      id: a.equipamento_id,
      properties: {
        equipamento_id: a.equipamento_id,
        apontamento_id: a.apontamento_id ?? "",
        status_mapa: a.status_mapa,
        status_label: a.status_label ?? status.label,
        status_color: status.mapboxColor,
        equipamento: a.subcategoria_nome || a.categoria_nome || "Equipamento",
        frota: a.frota ?? "",
        numero_frota: a.numero_frota ?? "",
        placa: a.placa ?? "",
        centro_custo:
          a.centro_custo_codigo ||
          (a.centro_custo_nome ? a.centro_custo_nome.split(/[—\-·]/)[0].trim() : "—"),
        operador: a.operador_nome ?? "—",
        situacao_ui: traduzirSituacaoUI(a.situacao_veiculo),
        data_registro: a.data_registro,
        precisao_gps: a.precisao_gps,
        horimetro_final: a.horimetro_final,
        qtd_nao_ok: a.qtd_nao_ok ?? 0,
      },
      geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
    });
  }
  return {
    featureCollection: { type: "FeatureCollection", features },
    descartados,
  };
}

export function fitFeatureCollection(
  map: mapboxgl.Map,
  fc: MapaOpFeatureCollection,
  opts: { padding?: number; maxZoom?: number; singleZoom?: number; duration?: number } = {},
) {
  const feats = fc.features;
  if (feats.length === 0) return;
  const { padding = 60, maxZoom = 14, singleZoom = 15, duration = 600 } = opts;
  if (feats.length === 1) {
    map.easeTo({ center: feats[0].geometry.coordinates, zoom: singleZoom, duration });
    return;
  }
  const bounds = new mapboxgl.LngLatBounds();
  feats.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding, maxZoom, duration });
}


function formatTempoDecorrido(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60_000));
    if (diffMin < 1) return "agora mesmo";
    if (diffMin < 60) return `há ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `há ${h} h`;
    return `há ${Math.floor(h / 24)} d`;
  } catch {
    return "";
  }
}

/**
 * Constrói o DOM do popup usando createElement + textContent (sem innerHTML).
 */
export function buildMapaOperacionalPopupDom(p: MapaOpFeatureProps): HTMLElement {
  const root = document.createElement("div");
  root.className = "text-xs space-y-1 min-w-[240px] max-w-[280px]";

  const title = document.createElement("div");
  title.className = "font-semibold text-sm";
  const frotaLabel = [p.frota, p.numero_frota].filter(Boolean).join(" ").trim();
  title.textContent = frotaLabel || p.placa || p.equipamento || "Ativo";
  root.appendChild(title);

  const sub = document.createElement("div");
  sub.className = "text-muted-foreground";
  sub.textContent = p.equipamento;
  root.appendChild(sub);

  const statusRow = document.createElement("div");
  statusRow.className = "flex items-center gap-1.5 pt-1";
  const dot = document.createElement("span");
  dot.style.display = "inline-block";
  dot.style.width = "8px";
  dot.style.height = "8px";
  dot.style.borderRadius = "9999px";
  dot.style.backgroundColor = p.status_color;
  const st = document.createElement("span");
  st.textContent = p.status_label;
  st.style.fontWeight = "600";
  statusRow.appendChild(dot);
  statusRow.appendChild(st);
  root.appendChild(statusRow);

  const linhas: Array<[string, string]> = [
    ["CC", p.centro_custo],
    ["Operador", p.operador],
    ["Situação", p.situacao_ui],
    ["Placa", p.placa || "—"],
  ];
  if (p.horimetro_final != null) linhas.push(["Horímetro/KM", String(p.horimetro_final)]);
  const decorrido = formatTempoDecorrido(p.data_registro);
  if (decorrido) linhas.push(["", decorrido]);

  for (const [k, v] of linhas) {
    const row = document.createElement("div");
    row.className = "flex gap-1";
    if (k) {
      const label = document.createElement("span");
      label.className = "text-muted-foreground";
      label.textContent = `${k}:`;
      row.appendChild(label);
    }
    const val = document.createElement("span");
    val.textContent = v;
    row.appendChild(val);
    root.appendChild(row);
  }

  const cta = document.createElement("div");
  cta.className = "pt-1 text-[11px] italic text-muted-foreground";
  cta.textContent = "Clique para ver detalhes";
  root.appendChild(cta);

  return root;
}

/**
 * SVG branco de caminhão para registrar como sprite SDF via map.addImage.
 */
export const MACHINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17h1V7a1 1 0 0 1 1-1h10v11"/><path d="M14 10h4l3 4v3h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`;

/**
 * Carrega o SVG como HTMLImageElement pronto para map.addImage({sdf:true}).
 */
export function loadMachineIcon(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(32, 32);
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(MACHINE_ICON_SVG)}`;
  });
}
