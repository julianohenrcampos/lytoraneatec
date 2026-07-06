import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, MapPin, Undo2, Trash2, Pencil, Shapes, Check, X } from "lucide-react";
import { useGeocoding } from "@/hooks/useGeocoding";
import type {
  RelatorioApsCoordenada,
  RelatorioApsPontoServico,
} from "@/types/relatorioAps";

/** Cores/opacidades do desenho no mapa — centralizadas para evitar hardcodes espalhados. */
const MAP_DRAW_COLOR = "#DD2C00";
const MAP_DRAW_TEXT_COLOR = "#FFFFFF";
const MAP_DRAW_FILL_OPACITY = 0.25;

interface Props {
  pontosServico: RelatorioApsPontoServico[];
  linhaServico: RelatorioApsCoordenada[];
  areasAplicacao: RelatorioApsCoordenada[][];
  areaEmEdicao?: RelatorioApsCoordenada[];
  onAdicionarPontoLinha: (coord: RelatorioApsCoordenada) => void;
  onDesfazerLinha: () => void;
  onLimparLinha: () => void;
  onIniciarArea: () => void;
  onAdicionarPontoArea: (coord: RelatorioApsCoordenada) => void;
  onDesfazerPontoArea: () => void;
  onFecharArea: () => void;
  onCancelarArea: () => void;
  onLimparAreas: () => void;
}

/** Handle imperativo para captura do canvas do mapa (B.3.5-E4-B). */
export interface RelatorioApsMapaHandle {
  capturarPngDataUrl: () => string | null;
}

const LINHA_SOURCE_ID = "relatorio-aps-linha";
const LINHA_LAYER_ID = "relatorio-aps-linha-layer";
const PONTOS_SOURCE_ID = "relatorio-aps-pontos";
const PONTOS_CIRCLE_LAYER_ID = "relatorio-aps-pontos-circle";
const PONTOS_LABEL_LAYER_ID = "relatorio-aps-pontos-label";
const AREAS_SOURCE_ID = "relatorio-aps-areas";
const AREAS_FILL_LAYER_ID = "relatorio-aps-areas-fill";
const AREAS_LINE_LAYER_ID = "relatorio-aps-areas-line";
const AREA_EDIT_SOURCE_ID = "relatorio-aps-area-edit";
const AREA_EDIT_FILL_LAYER_ID = "relatorio-aps-area-edit-fill";
const AREA_EDIT_LINE_LAYER_ID = "relatorio-aps-area-edit-line";
const CENTRO_BR: [number, number] = [-47.9292, -15.7801];

type Modo = "idle" | "linha" | "area";

const emptyFC = (): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

const RelatorioApsMapa = forwardRef<RelatorioApsMapaHandle, Props>(function RelatorioApsMapa(
  {
    pontosServico,
    linhaServico,
    areasAplicacao,
    areaEmEdicao,
    onAdicionarPontoLinha,
    onDesfazerLinha,
    onLimparLinha,
    onIniciarArea,
    onAdicionarPontoArea,
    onDesfazerPontoArea,
    onFecharArea,
    onCancelarArea,
    onLimparAreas,
  },
  ref,
) {
  const { getPublicToken } = useGeocoding();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [modo, setModo] = useState<Modo>("idle");

  useImperativeHandle(
    ref,
    () => ({
      capturarPngDataUrl: () => {
        try {
          const map = mapRef.current;
          if (!map) return null;
          map.triggerRepaint();
          const canvas = map.getCanvas();
          return canvas.toDataURL("image/png");
        } catch (e) {
          console.warn("[RELATORIO_APS][MAPA] capturarPngDataUrl falhou:", e);
          return null;
        }
      },
    }),
    [],
  );

  // Init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const token = await getPublicToken();
      if (!token || cancelled) return;
      mapboxgl.accessToken = token;
      setTokenReady(true);

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: CENTRO_BR,
        zoom: 4,
        preserveDrawingBuffer: true,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", () => {
        // Linha (traçado)
        map.addSource(LINHA_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          },
        });
        map.addLayer({
          id: LINHA_LAYER_ID,
          type: "line",
          source: LINHA_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": MAP_DRAW_COLOR, "line-width": 4 },
        });

        // Áreas finalizadas
        map.addSource(AREAS_SOURCE_ID, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: AREAS_FILL_LAYER_ID,
          type: "fill",
          source: AREAS_SOURCE_ID,
          paint: {
            "fill-color": MAP_DRAW_COLOR,
            "fill-opacity": MAP_DRAW_FILL_OPACITY,
          },
        });
        map.addLayer({
          id: AREAS_LINE_LAYER_ID,
          type: "line",
          source: AREAS_SOURCE_ID,
          paint: { "line-color": MAP_DRAW_COLOR, "line-width": 2 },
        });

        // Área em edição
        map.addSource(AREA_EDIT_SOURCE_ID, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: AREA_EDIT_FILL_LAYER_ID,
          type: "fill",
          source: AREA_EDIT_SOURCE_ID,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-color": MAP_DRAW_COLOR,
            "fill-opacity": MAP_DRAW_FILL_OPACITY,
          },
        });
        map.addLayer({
          id: AREA_EDIT_LINE_LAYER_ID,
          type: "line",
          source: AREA_EDIT_SOURCE_ID,
          paint: {
            "line-color": MAP_DRAW_COLOR,
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });

        // Pontos numerados (dentro do canvas para captura no PDF)
        map.addSource(PONTOS_SOURCE_ID, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: PONTOS_CIRCLE_LAYER_ID,
          type: "circle",
          source: PONTOS_SOURCE_ID,
          paint: {
            "circle-radius": 11,
            "circle-color": MAP_DRAW_COLOR,
            "circle-stroke-width": 2,
            "circle-stroke-color": MAP_DRAW_TEXT_COLOR,
          },
        });
        map.addLayer({
          id: PONTOS_LABEL_LAYER_ID,
          type: "symbol",
          source: PONTOS_SOURCE_ID,
          layout: {
            "text-field": ["to-string", ["get", "sequencia"]],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 11,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": MAP_DRAW_TEXT_COLOR },
        });

        console.log("[RELATORIO_APS][MAPA_INIT]");
        setMapReady(true);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pontos numerados + centralização
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource(PONTOS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: pontosServico.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
        properties: {
          sequencia: p.sequencia,
          logradouro: p.logradouro,
        },
      })),
    });

    if (pontosServico.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      pontosServico.forEach((p) => bounds.extend([p.longitude, p.latitude]));
      map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 17 });
    } else if (pontosServico.length === 1) {
      map.easeTo({
        center: [pontosServico[0].longitude, pontosServico[0].latitude],
        zoom: 16,
        duration: 600,
      });
    }
  }, [pontosServico, mapReady]);

  // Polyline (traçado)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource(LINHA_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: linhaServico.map((c) => [c.longitude, c.latitude]),
      },
    });
  }, [linhaServico, mapReady]);

  // Áreas finalizadas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource(AREAS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: areasAplicacao.map((poly) => {
        const ring = poly.map((c) => [c.longitude, c.latitude] as [number, number]);
        // Fecha o anel (primeiro == último)
        if (ring.length > 0) ring.push(ring[0]);
        return {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [ring] },
        };
      }),
    });
  }, [areasAplicacao, mapReady]);

  // Área em edição
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource(AREA_EDIT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const pts = areaEmEdicao ?? [];
    if (pts.length === 0) {
      src.setData(emptyFC());
      return;
    }
    const coords = pts.map((c) => [c.longitude, c.latitude] as [number, number]);
    if (pts.length >= 3) {
      const ring = [...coords, coords[0]];
      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [ring] },
          },
        ],
      });
    } else {
      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        ],
      });
    }
  }, [areaEmEdicao, mapReady]);

  // Click handler segundo o modo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const canvas = map.getCanvas();
    canvas.style.cursor = modo === "idle" ? "" : "crosshair";

    if (modo === "idle") return;

    const handler = (e: mapboxgl.MapMouseEvent) => {
      const coord: RelatorioApsCoordenada = {
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      };
      if (modo === "linha") onAdicionarPontoLinha(coord);
      else if (modo === "area") onAdicionarPontoArea(coord);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
      canvas.style.cursor = "";
    };
  }, [modo, mapReady, onAdicionarPontoLinha, onAdicionarPontoArea]);

  const semGps = pontosServico.length === 0;
  const editandoArea = areaEmEdicao !== undefined;
  const podeFechar = (areaEmEdicao?.length ?? 0) >= 3;

  const handleToggleLinha = () => {
    setModo((m) => (m === "linha" ? "idle" : "linha"));
  };
  const handleToggleArea = () => {
    setModo((m) => {
      if (m === "area") return "idle";
      if (!editandoArea) onIniciarArea();
      return "area";
    });
  };
  const handleDesfazer = () => {
    if (modo === "area" || editandoArea) onDesfazerPontoArea();
    else onDesfazerLinha();
  };
  const handleFechar = () => {
    onFecharArea();
    setModo("idle");
  };
  const handleCancelarArea = () => {
    onCancelarArea();
    setModo("idle");
  };

  const undoDisabled =
    modo === "area" || editandoArea
      ? (areaEmEdicao?.length ?? 0) === 0
      : linhaServico.length === 0;

  return (
    <div className="space-y-2">
      {semGps && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este registro não possui pontos com GPS para exibir no mapa. Você ainda pode
            desenhar manualmente o traçado ou marcar áreas de aplicação.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={modo === "linha" ? "default" : "outline"}
          onClick={handleToggleLinha}
          disabled={!mapReady}
        >
          <Pencil className="h-4 w-4 mr-1" />
          {modo === "linha" ? "Parar traçado" : "Adicionar traçado"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={modo === "area" ? "default" : "outline"}
          onClick={handleToggleArea}
          disabled={!mapReady}
        >
          <Shapes className="h-4 w-4 mr-1" />
          {modo === "area" ? "Parar área" : "Adicionar área"}
        </Button>
        {editandoArea && (
          <>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleFechar}
              disabled={!podeFechar}
              title={podeFechar ? "Fechar polígono" : "Adicione pelo menos 3 pontos"}
            >
              <Check className="h-4 w-4 mr-1" />
              Fechar área
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancelarArea}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar área
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleDesfazer}
          disabled={undoDisabled}
        >
          <Undo2 className="h-4 w-4 mr-1" />
          Desfazer último ponto
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onLimparLinha}
          disabled={linhaServico.length === 0}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Limpar traçado
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onLimparAreas}
          disabled={areasAplicacao.length === 0 && !editandoArea}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Limpar áreas
        </Button>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {linhaServico.length} traçado · {areasAplicacao.length} área
          {areasAplicacao.length === 1 ? "" : "s"}
        </span>
      </div>

      {modo !== "idle" && (
        <p className="text-xs text-muted-foreground">
          {modo === "linha"
            ? "Clique no mapa para adicionar pontos ao traçado."
            : "Clique no mapa para adicionar vértices ao polígono. Com 3+ pontos, use “Fechar área”."}
        </p>
      )}

      <div
        ref={containerRef}
        className="w-full h-[420px] rounded-md border bg-muted overflow-hidden"
      />

      {!tokenReady && (
        <p className="text-xs text-muted-foreground">Carregando mapa…</p>
      )}
    </div>
  );
});

export default RelatorioApsMapa;
