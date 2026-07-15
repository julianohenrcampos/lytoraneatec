import mapboxgl from "mapbox-gl";
import {
  STATUS_COLORS,
  type MapaOperacionalAtivo,
  type MapaOperacionalCentroCusto,
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

// =========================================================
// Centros de Custo — camada georreferenciada
// =========================================================

export interface CentroCustoFeatureProps {
  centro_custo_id: string;
  codigo: string;
  nome: string;
  endereco: string;
  total_alocados: number;
  total_com_gps: number;
  total_sem_gps: number;
  equipamentos_json: string;
}

export interface CentroCustoFeature {
  type: "Feature";
  id: string;
  properties: CentroCustoFeatureProps;
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface CentroCustoFeatureCollection {
  type: "FeatureCollection";
  features: CentroCustoFeature[];
}

export function buildCentroCustoFeatureCollection(
  ccs: MapaOperacionalCentroCusto[],
): CentroCustoFeatureCollection {
  const features: CentroCustoFeature[] = [];
  for (const cc of ccs) {
    if (!Number.isFinite(cc.latitude) || !Number.isFinite(cc.longitude)) continue;
    if (cc.latitude === 0 && cc.longitude === 0) continue;
    features.push({
      type: "Feature",
      id: cc.centro_custo_id,
      properties: {
        centro_custo_id: cc.centro_custo_id,
        codigo: cc.codigo ?? "",
        nome: cc.nome ?? "",
        endereco: cc.endereco ?? "",
        total_alocados: cc.total_alocados ?? 0,
        total_com_gps: cc.total_com_gps ?? 0,
        total_sem_gps: cc.total_sem_gps ?? 0,
        equipamentos_json: JSON.stringify(cc.equipamentos ?? []),
      },
      geometry: { type: "Point", coordinates: [cc.longitude, cc.latitude] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * SVG colorido (não-SDF) usado como marcador de Centro de Custo.
 * Fábrica industrial estilizada com fundo circular branco e traço azul,
 * claramente diferente do ícone dos equipamentos.
 */
export const CC_FACTORY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
  </defs>
  <circle cx="22" cy="22" r="18" fill="#ffffff" stroke="#0369A1" stroke-width="2.2" filter="url(#s)"/>
  <g fill="none" stroke="#0369A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 30 V21 l5 3 V21 l5 3 V19 l7 4 V30 Z" fill="#0EA5E9" fill-opacity="0.18"/>
    <path d="M12 30 h18"/>
    <path d="M15 17 v-3 M20 17 v-3"/>
    <circle cx="15" cy="12.5" r="1.1" fill="#0369A1"/>
    <circle cx="20" cy="12.5" r="1.1" fill="#0369A1"/>
  </g>
</svg>`;

/** Fallback: pin de localização caso o ícone fábrica falhe. */
export const CC_PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <path d="M22 4c-7 0-12 5-12 12 0 8.5 12 24 12 24s12-15.5 12-24c0-7-5-12-12-12z" fill="#0EA5E9" stroke="#ffffff" stroke-width="2"/>
  <circle cx="22" cy="16" r="4.5" fill="#ffffff"/>
</svg>`;

export function loadCentroCustoIcon(svg = CC_FACTORY_ICON_SVG): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(44, 44);
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Popup resumido de Centro de Custo (hover). A listagem completa é feita no modal.
 */
export function buildCentroCustoPopupDom(p: CentroCustoFeatureProps): HTMLElement {
  const root = document.createElement("div");
  root.className = "text-xs space-y-1 min-w-[220px] max-w-[280px]";

  const title = document.createElement("div");
  title.className = "font-semibold text-sm flex items-center gap-1.5";
  const badge = document.createElement("span");
  badge.style.display = "inline-block";
  badge.style.width = "8px";
  badge.style.height = "8px";
  badge.style.borderRadius = "9999px";
  badge.style.backgroundColor = "#0EA5E9";
  title.appendChild(badge);
  const tspan = document.createElement("span");
  tspan.textContent = p.codigo ? `${p.codigo} — ${p.nome}` : p.nome || "Centro de Custo";
  title.appendChild(tspan);
  root.appendChild(title);

  if (p.endereco) {
    const addr = document.createElement("div");
    addr.className = "text-muted-foreground";
    addr.textContent = p.endereco;
    root.appendChild(addr);
  }

  const totals = document.createElement("div");
  totals.className = "pt-1 flex flex-wrap gap-x-3 gap-y-0.5";
  const mk = (label: string, val: number) => {
    const s = document.createElement("span");
    const l = document.createElement("span");
    l.className = "text-muted-foreground";
    l.textContent = `${label}: `;
    const v = document.createElement("span");
    v.style.fontWeight = "600";
    v.textContent = String(val);
    s.appendChild(l);
    s.appendChild(v);
    return s;
  };
  totals.appendChild(mk("Alocados", p.total_alocados));
  totals.appendChild(mk("Com GPS", p.total_com_gps));
  totals.appendChild(mk("Sem GPS", p.total_sem_gps));
  root.appendChild(totals);

  const cta = document.createElement("div");
  cta.className = "pt-1 text-[11px] italic text-muted-foreground";
  cta.textContent = "Clique para ver equipamentos";
  root.appendChild(cta);

  return root;
}

