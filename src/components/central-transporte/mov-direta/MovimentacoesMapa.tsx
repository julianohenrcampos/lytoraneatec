/**
 * CT-4 Fase 3 — mapa das Movimentações (Central do Transporte).
 *
 * Componente próprio de CT: NÃO reaproveita o mapa do Mapa Operacional
 * (especializado em ativos/clusters/CCs). Aqui o mapa é inicializado uma única
 * vez e as atualizações trocam apenas os dados dos sources GeoJSON.
 *
 * Rotas vêm exclusivamente da geometria persistida em bd_ct_viagens
 * (rota_geometria). Este componente nunca chama a Directions API.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useGeocoding } from "@/hooks/useGeocoding";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";
import {
  chipRotaFeature,
  coordenadasParaFit,
  pontosDaMovimentacao,
  rotaFeature,
  type MovPonto,
} from "@/lib/central-transporte/movimentacoesWorkspace";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { calcularRotaMultiparadas } from "@/services/ctRotaService";

const ROTAS_SRC = "ct4-rotas-src";
const ROTAS_HALO = "ct4-rotas-halo";
const ROTAS_BASE = "ct4-rotas-base";
const ROTAS_LINE = "ct4-rotas-line";
const PONTOS_SRC = "ct4-pontos-src";
const PONTOS_PIN = "ct4-pontos-pin";
const PONTOS_LABEL = "ct4-pontos-label";
const CHIPS_SRC = "ct4-chips-src";
const CHIPS_LABEL = "ct4-chips-label";
const IMG_PIN_ORIGEM = "ct4-pin-origem";
const IMG_PIN_PARADA = "ct4-pin-parada";

const RJ_CENTER: [number, number] = [-43.1729, -22.9068];

/** Pin (map marker) desenhado em canvas — evita dependência de sprite externo. */
const criarPinImage = (
  corPreenchimento: string,
): { width: number; height: number; data: Uint8Array } | null => {
  const escala = 2;
  const w = 30 * escala;
  const h = 40 * escala;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(escala, escala);
  ctx.beginPath();
  // Gota: círculo superior + ponta inferior.
  ctx.moveTo(15, 38);
  ctx.bezierCurveTo(6, 25, 2, 20, 2, 14);
  ctx.arc(15, 14, 13, Math.PI, 0);
  ctx.bezierCurveTo(28, 20, 24, 25, 15, 38);
  ctx.closePath();
  ctx.fillStyle = corPreenchimento;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  const img = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: new Uint8Array(img.data) };
};

const esc = (v: string | null | undefined): string =>
  (v ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );

const dataLegivel = (v: string | null): string => {
  if (!v) return "—";
  const [d, hora] = v.split(" ");
  const base = formatBrazilianDateForDisplay(d);
  return hora ? `${base} ${hora.slice(0, 5)}` : base;
};

export const popupHtml = (p: MovPonto): string => {
  const cabecalho =
    p.tipo === "ORIGEM" ? "Origem da coleta" : `Parada ${p.ordem} de ${p.totalParadas}`;
  const pessoaLabel = p.tipo === "ORIGEM" ? "Motorista" : "Recebedor";
  const quandoLabel = p.tipo === "ORIGEM" ? "Saída prevista" : "Previsto";
  return [
    `<div style="font-size:12px;line-height:1.35;min-width:190px">`,
    `<div style="font-weight:600">${esc(p.codigo)}</div>`,
    `<div style="color:#6b7280;margin-bottom:4px">${esc(cabecalho)}</div>`,
    `<div style="font-weight:500">${esc(p.titulo)}</div>`,
    p.endereco ? `<div style="color:#6b7280">${esc(p.endereco)}</div>` : "",
    `<div>${quandoLabel}: ${esc(dataLegivel(p.quando))}</div>`,
    p.tipo === "PARADA" ? `<div>Ativos: ${p.ativos}</div>` : "",
    p.pessoa ? `<div>${pessoaLabel}: ${esc(p.pessoa)}</div>` : "",
    `</div>`,
  ].join("");
};


interface Props {
  viagens: CtOrdemMotorista[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  onErro?: (msg: string) => void;
  className?: string;
}

const MovimentacoesMapa: React.FC<Props> = ({
  viagens,
  selecionadoId,
  onSelecionar,
  onErro,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const prontoRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const pendenteRef = useRef<{ rotas: unknown; pontos: unknown; chips: unknown } | null>(
    null,
  );
  const onSelecionarRef = useRef(onSelecionar);
  onSelecionarRef.current = onSelecionar;
  const onErroRef = useRef(onErro);
  onErroRef.current = onErro;
  const { getPublicToken } = useGeocoding();
  const [falhou, setFalhou] = useState(false);

  /**
   * CT-4 — rota sob demanda: movimentações antigas sem snapshot persistido
   * ganham geometria da Directions API APENAS quando selecionadas, uma única
   * vez, sem loop sobre a lista e sem persistir nada.
   */
  const [rotasSobDemanda, setRotasSobDemanda] = useState<
    Record<
      string,
      {
        geometria: { type: "LineString"; coordinates: [number, number][] };
        distanciaKm: number;
        duracaoMin: number | null;
      } | null
    >
  >({});

  const viagensComRota = useMemo(
    () =>
      viagens.map((v) => {
        if (v.rotaGeometria) return v;
        const extra = rotasSobDemanda[v.id];
        if (!extra) return v;
        return {
          ...v,
          rotaGeometria: extra.geometria,
          distanciaRotaKm: v.distanciaRotaKm ?? extra.distanciaKm,
          duracaoRotaMin: v.duracaoRotaMin ?? extra.duracaoMin,
        };
      }),
    [viagens, rotasSobDemanda],
  );

  useEffect(() => {
    if (!selecionadoId) return;
    const viagem = viagens.find((v) => v.id === selecionadoId);
    if (!viagem || viagem.rotaGeometria) return;
    if (selecionadoId in rotasSobDemanda) return;
    const coords = pontosDaMovimentacao(viagem).map((p) => ({
      longitude: p.coord[0],
      latitude: p.coord[1],
    }));
    if (coords.length < 2) {
      setRotasSobDemanda((prev) => ({ ...prev, [selecionadoId]: null }));
      return;
    }
    let cancelado = false;
    void (async () => {
      const rota = await calcularRotaMultiparadas(coords);
      if (cancelado) return;
      setRotasSobDemanda((prev) => ({
        ...prev,
        [selecionadoId]:
          rota && rota.geometria
            ? {
                geometria: rota.geometria,
                distanciaKm: rota.distanciaKm,
                duracaoMin: rota.duracaoMin,
              }
            : null,
      }));
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadoId, viagens]);

  const pontosPorId = useMemo(() => {
    const m = new Map<string, MovPonto>();
    viagens.forEach((v) =>
      pontosDaMovimentacao(v).forEach((p) =>
        m.set(`${p.movId}:${p.tipo}:${p.ordem ?? 0}`, p),
      ),
    );
    return m;
  }, [viagens]);

  /* Feature collections memoizadas: nenhuma recriação de mapa por render. */
  const rotasFc = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: viagensComRota
        .map((v) => rotaFeature(v, v.id === selecionadoId))
        .filter((f): f is NonNullable<typeof f> => !!f),
    }),
    [viagensComRota, selecionadoId],
  );

  const pontosFc = useMemo(() => {
    const features = Array.from(pontosPorId.values())
      .filter((p) => (selecionadoId ? p.movId === selecionadoId : p.tipo === "ORIGEM"))
      .map((p) => ({
        type: "Feature" as const,
        properties: {
          chave: `${p.movId}:${p.tipo}:${p.ordem ?? 0}`,
          mov_id: p.movId,
          rotulo: p.tipo === "ORIGEM" ? "" : String(p.ordem),
          tipo: p.tipo,
          selecionado: p.movId === selecionadoId,
        },
        geometry: { type: "Point" as const, coordinates: p.coord },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [pontosPorId, selecionadoId]);

  /** Chips de distância/duração — apenas da movimentação selecionada. */
  const chipsFc = useMemo(() => {
    const sel = selecionadoId ? viagensComRota.find((v) => v.id === selecionadoId) : null;
    const chip = sel ? chipRotaFeature(sel) : null;
    return {
      type: "FeatureCollection" as const,
      features: chip ? [chip] : [],
    };
  }, [viagensComRota, selecionadoId]);

  const pontosPorIdRef = useRef(pontosPorId);
  pontosPorIdRef.current = pontosPorId;

  const aplicarDados = useCallback(() => {
    const map = mapRef.current;
    if (!map || !prontoRef.current) {
      pendenteRef.current = { rotas: rotasFc, pontos: pontosFc, chips: chipsFc };
      return;
    }
    (map.getSource(ROTAS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(
      rotasFc as never,
    );
    (map.getSource(PONTOS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(
      pontosFc as never,
    );
    (map.getSource(CHIPS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(
      chipsFc as never,
    );
  }, [rotasFc, pontosFc, chipsFc]);

  /* ---- init (uma única vez) ---- */
  useEffect(() => {
    let cancelado = false;

    const iniciar = async () => {
      const token = await getPublicToken();
      if (cancelado || !containerRef.current) return;
      if (!token) {
        setFalhou(true);
        onErroRef.current?.("MAPBOX_TOKEN_INDISPONIVEL");
        return;
      }
      mapboxgl.accessToken = token;
      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: RJ_CENTER,
          zoom: 7,
          attributionControl: false,
        });
      } catch (e) {
        console.error("MovimentacoesMapa init", e);
        setFalhou(true);
        onErroRef.current?.("MAPBOX_FALHA_INICIALIZACAO");
        return;
      }
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => console.error("MovimentacoesMapa", e?.error ?? e));

      map.on("load", () => {
        if (cancelado) return;

        /* Pins (map markers) registrados como imagens do estilo. */
        [
          [IMG_PIN_ORIGEM, "#1A1A1A"],
          [IMG_PIN_PARADA, "#DD2C00"],
        ].forEach(([nome, cor]) => {
          const img = criarPinImage(cor);
          if (img && !map.hasImage(nome)) {
            map.addImage(nome, img, { pixelRatio: 2 });
          }
        });

        map.addSource(ROTAS_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        /* Halo largo: dá presença ao trajeto selecionado. */
        map.addLayer({
          id: ROTAS_HALO,
          type: "line",
          source: ROTAS_SRC,
          filter: ["==", ["get", "selecionado"], true],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#1E3A8A", "line-width": 16, "line-opacity": 0.12 },
        });
        /* Camada base (contorno escuro) + camada principal (linha viva). */
        map.addLayer({
          id: ROTAS_BASE,
          type: "line",
          source: ROTAS_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["case", ["get", "selecionado"], "#1E3A8A", "#CBD5E1"],
            "line-width": ["case", ["get", "selecionado"], 11, 4],
            "line-opacity": ["case", ["get", "selecionado"], 0.95, 0.35],
          },
        });
        map.addLayer({
          id: ROTAS_LINE,
          type: "line",
          source: ROTAS_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": [
              "case",
              /* Cancelada é histórico: nunca destacada como operação ativa. */
              ["==", ["get", "status"], "CANCELADA"],
              "#94A3B8",
              ["get", "selecionado"],
              "#3B82F6",
              "#94A3B8",
            ],
            "line-width": [
              "case",
              ["==", ["get", "status"], "CANCELADA"],
              2,
              ["get", "selecionado"],
              6,
              2,
            ],
            "line-opacity": [
              "case",
              ["==", ["get", "status"], "CANCELADA"],
              0.35,
              ["get", "selecionado"],
              1,
              0.5,
            ],
          },
        });

        map.addSource(PONTOS_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: PONTOS_PIN,
          type: "symbol",
          source: PONTOS_SRC,
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "tipo"], "ORIGEM"],
              IMG_PIN_ORIGEM,
              IMG_PIN_PARADA,
            ],
            "icon-size": 1,
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
          },
        });
        map.addLayer({
          id: PONTOS_LABEL,
          type: "symbol",
          source: PONTOS_SRC,
          layout: {
            "text-field": ["get", "rotulo"],
            "text-size": 12,
            "text-offset": [0, -1.6],
            "text-allow-overlap": true,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: { "text-color": "#ffffff" },
        });

        map.addSource(CHIPS_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: CHIPS_LABEL,
          type: "symbol",
          source: CHIPS_SRC,
          layout: {
            "text-field": [
              "case",
              ["!=", ["get", "duracao"], ""],
              ["concat", ["get", "duracao"], "\n", ["get", "distancia"]],
              ["get", "distancia"],
            ],
            "text-size": 12,
            "text-line-height": 1.2,
            "text-allow-overlap": true,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#1E3A8A",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
          },
        });

        prontoRef.current = true;
        if (pendenteRef.current) {
          (map.getSource(ROTAS_SRC) as mapboxgl.GeoJSONSource).setData(
            pendenteRef.current.rotas as never,
          );
          (map.getSource(PONTOS_SRC) as mapboxgl.GeoJSONSource).setData(
            pendenteRef.current.pontos as never,
          );
          (map.getSource(CHIPS_SRC) as mapboxgl.GeoJSONSource).setData(
            pendenteRef.current.chips as never,
          );
          pendenteRef.current = null;
        }

        const clicarPonto = (e: mapboxgl.MapLayerMouseEvent) => {
          const f = e.features?.[0];
          const movId = f?.properties?.mov_id as string | undefined;
          if (!movId) return;
          onSelecionarRef.current(movId);
          const chave = f?.properties?.chave as string | undefined;
          const ponto = chave ? pontosPorIdRef.current.get(chave) : null;
          if (ponto) {
            popupRef.current?.remove();
            popupRef.current = new mapboxgl.Popup({ offset: 24, closeButton: true })
              .setLngLat(ponto.coord)
              .setHTML(popupHtml(ponto))
              .addTo(map);
          }
        };
        map.on("click", PONTOS_PIN, clicarPonto);
        map.on("click", ROTAS_LINE, (e) => {
          const movId = e.features?.[0]?.properties?.mov_id as string | undefined;
          if (movId) onSelecionarRef.current(movId);
        });
        [PONTOS_PIN, ROTAS_LINE].forEach((layer) => {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        });
      });
    };


    void iniciar();

    return () => {
      cancelado = true;
      popupRef.current?.remove();
      popupRef.current = null;
      prontoRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    aplicarDados();
  }, [aplicarDados]);

  /* Enquadra a movimentação selecionada (rota persistida ou seus pontos). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prontoRef.current || !selecionadoId) return;
    const viagem = viagensComRota.find((v) => v.id === selecionadoId);
    if (!viagem) return;
    const coords = coordenadasParaFit(viagem);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.easeTo({ center: coords[0], zoom: 13, duration: 600 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  }, [selecionadoId, viagensComRota]);

  if (falhou) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground ${className ?? ""}`}
        data-testid="ct4-mapa-erro"
      >
        Não foi possível carregar o mapa agora.
        <br />
        As movimentações continuam disponíveis na lista.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Mapa das movimentações"
      className={`h-full w-full overflow-hidden rounded-md border ${className ?? ""}`}
      data-testid="ct4-mapa"
    />
  );
};

export default MovimentacoesMapa;
