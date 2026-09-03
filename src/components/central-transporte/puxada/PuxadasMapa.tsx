/**
 * CT-5 — mapa das Puxadas (coleta → descarga).
 *
 * Mesmo padrão do mapa de Movimentações (CT-4): mapa inicializado uma única
 * vez e atualizações apenas nos sources GeoJSON. Rotas vêm da geometria
 * PERSISTIDA em bd_ct_puxadas; itens antigos sem snapshot ganham rota da
 * Directions API apenas quando selecionados (nada é persistido aqui).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useGeocoding } from "@/hooks/useGeocoding";
import type { CtPuxada } from "@/types/centralTransportePuxada";
import {
  chipRotaFeaturePuxada,
  coordenadasParaFitPuxada,
  pontosDaPuxada,
  rotaFeaturePuxada,
  type PuxadaPonto,
} from "@/lib/central-transporte/puxadasWorkspace";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { calcularRotaMultiparadas } from "@/services/ctRotaService";

const ROTAS_SRC = "ct5-rotas-src";
const ROTAS_HALO = "ct5-rotas-halo";
const ROTAS_BASE = "ct5-rotas-base";
const ROTAS_LINE = "ct5-rotas-line";
const PONTOS_SRC = "ct5-pontos-src";
const PONTOS_PIN = "ct5-pontos-pin";
const CHIPS_SRC = "ct5-chips-src";
const CHIPS_LABEL = "ct5-chips-label";
const IMG_PIN_COLETA = "ct5-pin-coleta";
const IMG_PIN_DESCARGA = "ct5-pin-descarga";

const RJ_CENTER: [number, number] = [-43.1729, -22.9068];

/** Pin (map marker) desenhado em canvas — sem dependência de sprite externo. */
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

export const popupHtmlPuxada = (p: PuxadaPonto): string =>
  [
    `<div style="font-size:12px;line-height:1.35;min-width:190px">`,
    `<div style="font-weight:600">${esc(p.codigo)}</div>`,
    `<div style="color:#6b7280;margin-bottom:4px">${
      p.tipo === "COLETA" ? "Ponto de coleta" : "Ponto de descarga"
    }</div>`,
    `<div style="font-weight:500">${esc(p.titulo)}</div>`,
    p.endereco ? `<div style="color:#6b7280">${esc(p.endereco)}</div>` : "",
    `<div>Data: ${p.quando ? esc(formatBrazilianDateForDisplay(p.quando)) : "—"}</div>`,
    `<div>Caminhões: ${p.caminhoes}</div>`,
    `</div>`,
  ].join("");

interface Props {
  puxadas: CtPuxada[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  className?: string;
}

const PuxadasMapa: React.FC<Props> = ({
  puxadas,
  selecionadoId,
  onSelecionar,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const prontoRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const pendenteRef = useRef<{ rotas: unknown; pontos: unknown; chips: unknown } | null>(null);
  const onSelecionarRef = useRef(onSelecionar);
  onSelecionarRef.current = onSelecionar;
  const { getPublicToken } = useGeocoding();
  const [falhou, setFalhou] = useState(false);

  /** Rota sob demanda: só para a puxada selecionada e uma única vez. */
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

  const puxadasComRota = useMemo(
    () =>
      puxadas.map((p) => {
        if (p.rotaGeometria) return p;
        const extra = rotasSobDemanda[p.id];
        if (!extra) return p;
        return {
          ...p,
          rotaGeometria: extra.geometria,
          distanciaRotaKm: p.distanciaRotaKm ?? extra.distanciaKm,
          duracaoRotaMin: p.duracaoRotaMin ?? extra.duracaoMin,
        };
      }),
    [puxadas, rotasSobDemanda],
  );

  useEffect(() => {
    if (!selecionadoId) return;
    const puxada = puxadas.find((p) => p.id === selecionadoId);
    if (!puxada || puxada.rotaGeometria) return;
    if (selecionadoId in rotasSobDemanda) return;
    const coords = pontosDaPuxada(puxada).map((p) => ({
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
  }, [selecionadoId, puxadas]);

  const pontosPorId = useMemo(() => {
    const m = new Map<string, PuxadaPonto>();
    puxadas.forEach((p) =>
      pontosDaPuxada(p).forEach((x) => m.set(`${x.puxadaId}:${x.tipo}`, x)),
    );
    return m;
  }, [puxadas]);

  const rotasFc = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: puxadasComRota
        .map((p) => rotaFeaturePuxada(p, p.id === selecionadoId))
        .filter((f): f is NonNullable<typeof f> => !!f),
    }),
    [puxadasComRota, selecionadoId],
  );

  const pontosFc = useMemo(() => {
    const features = Array.from(pontosPorId.values())
      .filter((p) => (selecionadoId ? p.puxadaId === selecionadoId : p.tipo === "COLETA"))
      .map((p) => ({
        type: "Feature" as const,
        properties: {
          chave: `${p.puxadaId}:${p.tipo}`,
          puxada_id: p.puxadaId,
          tipo: p.tipo,
        },
        geometry: { type: "Point" as const, coordinates: p.coord },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [pontosPorId, selecionadoId]);

  const chipsFc = useMemo(() => {
    const sel = selecionadoId ? puxadasComRota.find((p) => p.id === selecionadoId) : null;
    const chip = sel ? chipRotaFeaturePuxada(sel) : null;
    return { type: "FeatureCollection" as const, features: chip ? [chip] : [] };
  }, [puxadasComRota, selecionadoId]);

  const pontosPorIdRef = useRef(pontosPorId);
  pontosPorIdRef.current = pontosPorId;

  const aplicarDados = useCallback(() => {
    const map = mapRef.current;
    if (!map || !prontoRef.current) {
      pendenteRef.current = { rotas: rotasFc, pontos: pontosFc, chips: chipsFc };
      return;
    }
    (map.getSource(ROTAS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(rotasFc as never);
    (map.getSource(PONTOS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(pontosFc as never);
    (map.getSource(CHIPS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(chipsFc as never);
  }, [rotasFc, pontosFc, chipsFc]);

  /* ---- init (uma única vez) ---- */
  useEffect(() => {
    let cancelado = false;

    const iniciar = async () => {
      const token = await getPublicToken();
      if (cancelado || !containerRef.current) return;
      if (!token) {
        setFalhou(true);
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
        console.error("PuxadasMapa init", e);
        setFalhou(true);
        return;
      }
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => console.error("PuxadasMapa", e?.error ?? e));

      map.on("load", () => {
        if (cancelado) return;

        [
          [IMG_PIN_COLETA, "#1A1A1A"],
          [IMG_PIN_DESCARGA, "#DD2C00"],
        ].forEach(([nome, cor]) => {
          const img = criarPinImage(cor);
          if (img && !map.hasImage(nome)) map.addImage(nome, img, { pixelRatio: 2 });
        });

        map.addSource(ROTAS_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: ROTAS_HALO,
          type: "line",
          source: ROTAS_SRC,
          filter: ["==", ["get", "selecionado"], true],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#1E3A8A", "line-width": 16, "line-opacity": 0.12 },
        });
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
              ["==", ["get", "tipo"], "COLETA"],
              IMG_PIN_COLETA,
              IMG_PIN_DESCARGA,
            ],
            "icon-size": 1,
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
          },
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

        map.on("click", PONTOS_PIN, (e) => {
          const f = e.features?.[0];
          const puxadaId = f?.properties?.puxada_id as string | undefined;
          if (!puxadaId) return;
          onSelecionarRef.current(puxadaId);
          const chave = f?.properties?.chave as string | undefined;
          const ponto = chave ? pontosPorIdRef.current.get(chave) : null;
          if (ponto) {
            popupRef.current?.remove();
            popupRef.current = new mapboxgl.Popup({ offset: 24, closeButton: true })
              .setLngLat(ponto.coord)
              .setHTML(popupHtmlPuxada(ponto))
              .addTo(map);
          }
        });
        map.on("click", ROTAS_LINE, (e) => {
          const puxadaId = e.features?.[0]?.properties?.puxada_id as string | undefined;
          if (puxadaId) onSelecionarRef.current(puxadaId);
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

  /* Enquadra a puxada selecionada (rota persistida ou seus pontos). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prontoRef.current || !selecionadoId) return;
    const puxada = puxadasComRota.find((p) => p.id === selecionadoId);
    if (!puxada) return;
    const coords = coordenadasParaFitPuxada(puxada);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.easeTo({ center: coords[0], zoom: 13, duration: 600 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  }, [selecionadoId, puxadasComRota]);

  if (falhou) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground ${className ?? ""}`}
        data-testid="ct5-mapa-erro"
      >
        Não foi possível carregar o mapa agora.
        <br />
        As puxadas continuam disponíveis na lista.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Mapa das puxadas"
      className={`h-full w-full overflow-hidden rounded-md border ${className ?? ""}`}
      data-testid="ct5-mapa"
    />
  );
};

export default PuxadasMapa;
