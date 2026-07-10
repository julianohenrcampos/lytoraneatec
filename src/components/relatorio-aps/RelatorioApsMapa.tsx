import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Info,
  MapPin,
  Undo2,
  Trash2,
  Pencil,
  Shapes,
  Check,
  X,
  Move,
  Plus,
  RotateCcw,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useGeocoding } from "@/hooks/useGeocoding";
import type {
  RelatorioApsCoordenada,
  RelatorioApsMarcadorManual,
  RelatorioApsPontoRua,
  RelatorioApsPontoServico,
  RelatorioApsSelecaoMarcador,
  RelatorioApsTipoMarcador,
} from "@/types/relatorioAps";

const MAP_DRAW_COLOR = "#DD2C00";
const MAP_DRAW_TEXT_COLOR = "#FFFFFF";
const MAP_DRAW_FILL_OPACITY = 0.25;

interface Props {
  pontosServico: RelatorioApsPontoServico[];
  pontosRua: RelatorioApsPontoRua[];
  linhaServico: RelatorioApsCoordenada[];
  areasAplicacao: RelatorioApsCoordenada[][];
  areaEmEdicao?: RelatorioApsCoordenada[];
  ajustesPontosServico: Record<string, { latitude: number; longitude: number }>;
  ajustesPontosRua: Record<string, { latitude: number; longitude: number }>;
  marcadoresManuais: RelatorioApsMarcadorManual[];
  selecaoMarcador?: RelatorioApsSelecaoMarcador;
  mostrarPontosRua: boolean;
  incluirPontosRuaNoPdf: boolean;
  onAdicionarPontoLinha: (coord: RelatorioApsCoordenada) => void;
  onDesfazerLinha: () => void;
  onLimparLinha: () => void;
  onIniciarArea: () => void;
  onAdicionarPontoArea: (coord: RelatorioApsCoordenada) => void;
  onDesfazerPontoArea: () => void;
  onFecharArea: () => void;
  onCancelarArea: () => void;
  onLimparAreas: () => void;
  onSelecionarMarcador: (tipo: RelatorioApsTipoMarcador, id: string) => void;
  onLimparSelecao: () => void;
  onAjustarPontoServico: (detalheId: string, coord: RelatorioApsCoordenada) => void;
  onAjustarPontoRua: (ruaId: string, coord: RelatorioApsCoordenada) => void;
  onAdicionarMarcadorManual: (coord: RelatorioApsCoordenada) => void;
  onMoverMarcadorManual: (id: string, coord: RelatorioApsCoordenada) => void;
  onRemoverMarcadorManual: (id: string) => void;
  onResetarAjustes: () => void;
  onSetMostrarPontosRua: (v: boolean) => void;
  onSetIncluirPontosRuaNoPdf: (v: boolean) => void;
}

/** Handle imperativo para captura do canvas do mapa. */
export interface RelatorioApsMapaHandle {
  capturarPngDataUrl: (opts?: { incluirPontosRua?: boolean }) => Promise<string | null>;
}

const LINHA_SOURCE_ID = "relatorio-aps-linha";
const LINHA_LAYER_ID = "relatorio-aps-linha-layer";
const PONTOS_SOURCE_ID = "relatorio-aps-pontos";
const PONTOS_CIRCLE_LAYER_ID = "relatorio-aps-pontos-circle";
const PONTOS_LABEL_LAYER_ID = "relatorio-aps-pontos-label";
const RUAS_SOURCE_ID = "relatorio-aps-ruas";
const RUAS_SYMBOL_LAYER_ID = "relatorio-aps-ruas-symbol";
const MANUAIS_SOURCE_ID = "relatorio-aps-manuais";
const MANUAIS_CIRCLE_LAYER_ID = "relatorio-aps-manuais-circle";
const MANUAIS_LABEL_LAYER_ID = "relatorio-aps-manuais-label";
const AREAS_SOURCE_ID = "relatorio-aps-areas";
const AREAS_FILL_LAYER_ID = "relatorio-aps-areas-fill";
const AREAS_LINE_LAYER_ID = "relatorio-aps-areas-line";
const AREA_EDIT_SOURCE_ID = "relatorio-aps-area-edit";
const AREA_EDIT_FILL_LAYER_ID = "relatorio-aps-area-edit-fill";
const AREA_EDIT_LINE_LAYER_ID = "relatorio-aps-area-edit-line";
const APS_PIN_IMAGE = "aps-pin";
const CENTRO_BR: [number, number] = [-47.9292, -15.7801];

type Modo = "idle" | "linha" | "area" | "ajustar" | "adicionar";

const CLICK_MAX_DIST = 4; // px (soma |dx|+|dy|)
const CLICK_MAX_MS = 400;
const IDLE_TIMEOUT_MS = 900;

const emptyFC = (): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

/** SVG do pin de localização (vermelho Lytorânea + miolo branco). */
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${MAP_DRAW_COLOR}" stroke="${MAP_DRAW_TEXT_COLOR}" stroke-width="2"/>
  <circle cx="14" cy="14" r="5" fill="${MAP_DRAW_TEXT_COLOR}"/>
</svg>`;

async function carregarPinImage(map: mapboxgl.Map): Promise<void> {
  if (map.hasImage(APS_PIN_IMAGE)) return;
  await new Promise<void>((resolve) => {
    const img = new Image(28, 40);
    img.onload = () => {
      try {
        if (!map.hasImage(APS_PIN_IMAGE)) {
          map.addImage(APS_PIN_IMAGE, img as unknown as HTMLImageElement, { pixelRatio: 2 });
        }
      } catch (e) {
        console.warn("[RELATORIO_APS][MAPA] addImage pin falhou:", e);
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`;
  });
}

const RelatorioApsMapa = forwardRef<RelatorioApsMapaHandle, Props>(function RelatorioApsMapa(
  {
    pontosServico,
    pontosRua,
    linhaServico,
    areasAplicacao,
    areaEmEdicao,
    ajustesPontosServico,
    ajustesPontosRua,
    marcadoresManuais,
    selecaoMarcador,
    mostrarPontosRua,
    onAdicionarPontoLinha,
    onDesfazerLinha,
    onLimparLinha,
    onIniciarArea,
    onAdicionarPontoArea,
    onDesfazerPontoArea,
    onFecharArea,
    onCancelarArea,
    onLimparAreas,
    onSelecionarMarcador,
    onLimparSelecao,
    onAjustarPontoServico,
    onAjustarPontoRua,
    onAdicionarMarcadorManual,
    onMoverMarcadorManual,
    onRemoverMarcadorManual,
    onResetarAjustes,
    onSetMostrarPontosRua,
    onSetIncluirPontosRuaNoPdf,
    incluirPontosRuaNoPdf,
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
      capturarPngDataUrl: async (opts?: { incluirPontosRua?: boolean }) => {
        const map = mapRef.current;
        if (!map) return null;
        const incluir = opts?.incluirPontosRua ?? true;
        let prevVisibility: "visible" | "none" = "visible";
        let alterou = false;
        try {
          if (map.getLayer(RUAS_SYMBOL_LAYER_ID)) {
            const raw = map.getLayoutProperty(RUAS_SYMBOL_LAYER_ID, "visibility");
            prevVisibility = raw === "none" ? "none" : "visible";
            const alvo: "visible" | "none" = incluir ? "visible" : "none";
            if (prevVisibility !== alvo) {
              map.setLayoutProperty(RUAS_SYMBOL_LAYER_ID, "visibility", alvo);
              alterou = true;
              map.triggerRepaint();
              await Promise.race([
                new Promise<void>((r) => map.once("idle", () => r())),
                new Promise<void>((r) => setTimeout(r, IDLE_TIMEOUT_MS)),
              ]);
            }
          }
          const canvas = map.getCanvas();
          return canvas.toDataURL("image/png");
        } catch (e) {
          console.warn("[RELATORIO_APS][MAPA] capturarPngDataUrl falhou:", e);
          return null;
        } finally {
          if (alterou && map.getLayer(RUAS_SYMBOL_LAYER_ID)) {
            try {
              map.setLayoutProperty(RUAS_SYMBOL_LAYER_ID, "visibility", prevVisibility);
              map.triggerRepaint();
            } catch {
              /* noop */
            }
          }
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

      map.on("load", async () => {
        await carregarPinImage(map);

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

        // Ruas — pin symbol (dentro do canvas, entra no PDF)
        map.addSource(RUAS_SOURCE_ID, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: RUAS_SYMBOL_LAYER_ID,
          type: "symbol",
          source: RUAS_SOURCE_ID,
          layout: {
            "icon-image": APS_PIN_IMAGE,
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "case",
              ["==", ["get", "selected"], true],
              0.95,
              0.8,
            ],
          },
        });

        // Pontos de serviço numerados
        map.addSource(PONTOS_SOURCE_ID, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: PONTOS_CIRCLE_LAYER_ID,
          type: "circle",
          source: PONTOS_SOURCE_ID,
          paint: {
            "circle-radius": 11,
            "circle-color": MAP_DRAW_COLOR,
            "circle-stroke-width": [
              "case",
              ["==", ["get", "selected"], true],
              5,
              2,
            ],
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

        // Manuais numerados
        map.addSource(MANUAIS_SOURCE_ID, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: MANUAIS_CIRCLE_LAYER_ID,
          type: "circle",
          source: MANUAIS_SOURCE_ID,
          paint: {
            "circle-radius": 11,
            "circle-color": MAP_DRAW_COLOR,
            "circle-stroke-width": [
              "case",
              ["==", ["get", "selected"], true],
              5,
              2,
            ],
            "circle-stroke-color": MAP_DRAW_TEXT_COLOR,
          },
        });
        map.addLayer({
          id: MANUAIS_LABEL_LAYER_ID,
          type: "symbol",
          source: MANUAIS_SOURCE_ID,
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

  // Coordenadas efetivas (aplicando ajustes)
  const coordServ = (p: RelatorioApsPontoServico): [number, number] => {
    const aj = ajustesPontosServico[p.detalheId];
    return aj ? [aj.longitude, aj.latitude] : [p.longitude, p.latitude];
  };
  const coordRua = (p: RelatorioApsPontoRua): [number, number] => {
    const aj = ajustesPontosRua[p.ruaId];
    return aj ? [aj.longitude, aj.latitude] : [p.longitude, p.latitude];
  };

  // ============ Efeito: setData dos pontos/rua/manuais (não centraliza) ============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const srcPontos = map.getSource(PONTOS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    const srcRuas = map.getSource(RUAS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    const srcManuais = map.getSource(MANUAIS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!srcPontos || !srcRuas || !srcManuais) return;

    const selServ = selecaoMarcador?.tipo === "servico" ? selecaoMarcador.id : null;
    const selRua = selecaoMarcador?.tipo === "rua" ? selecaoMarcador.id : null;
    const selMan = selecaoMarcador?.tipo === "manual" ? selecaoMarcador.id : null;

    srcPontos.setData({
      type: "FeatureCollection",
      features: pontosServico.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: coordServ(p) },
        properties: {
          tipo: "servico",
          id: p.detalheId,
          sequencia: p.sequencia,
          logradouro: p.logradouro,
          selected: selServ === p.detalheId,
        },
      })),
    });

    srcRuas.setData({
      type: "FeatureCollection",
      features: pontosRua.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: coordRua(p) },
        properties: {
          tipo: "rua",
          id: p.ruaId,
          ordem: p.ordem,
          logradouro: p.logradouro,
          selected: selRua === p.ruaId,
        },
      })),
    });

    srcManuais.setData({
      type: "FeatureCollection",
      features: marcadoresManuais.map((m) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
        properties: {
          tipo: "manual",
          id: m.id,
          sequencia: m.sequencia,
          selected: selMan === m.id,
        },
      })),
    });
  }, [
    pontosServico,
    pontosRua,
    marcadoresManuais,
    ajustesPontosServico,
    ajustesPontosRua,
    selecaoMarcador,
    mapReady,
  ]);

  // ============ Efeito: fit inicial por chave estável do relatório ============
  const lastFitKeyRef = useRef<string | null>(null);
  const reportKey = useMemo(() => {
    const s = pontosServico
      .map((p) => p.detalheId)
      .filter(Boolean)
      .sort();
    const r = pontosRua
      .map((p) => p.ruaId)
      .filter(Boolean)
      .sort();
    return JSON.stringify({ s, r });
  }, [pontosServico, pontosRua]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (lastFitKeyRef.current === reportKey) return;

    // Chave vazia (sem dados) → apenas registra e não centraliza
    const semDados = pontosServico.length === 0 && pontosRua.length === 0;
    if (semDados) {
      lastFitKeyRef.current = reportKey;
      return;
    }

    const todos: Array<[number, number]> = [
      ...pontosServico.map((p) => coordServ(p)),
      ...pontosRua.map((p) => coordRua(p)),
    ];
    if (todos.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      todos.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 17 });
    } else if (todos.length === 1) {
      map.easeTo({ center: todos[0], zoom: 16, duration: 600 });
    }
    lastFitKeyRef.current = reportKey;
    console.log("[RELATORIO_APS][MAPA_FIT_INITIAL]", { keyLen: reportKey.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, mapReady]);

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

  // Visibilidade da layer de rua (toggle "Mostrar pontos de rua")
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!map.getLayer(RUAS_SYMBOL_LAYER_ID)) return;
    map.setLayoutProperty(
      RUAS_SYMBOL_LAYER_ID,
      "visibility",
      mostrarPontosRua ? "visible" : "none",
    );
  }, [mostrarPontosRua, mapReady]);

  // Handler de clique baseado em mousedown/mouseup com threshold — não interfere em pan/zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = modo === "idle" ? "" : "crosshair";
    if (modo === "idle") return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let pressing = false;

    const onDown = (e: mapboxgl.MapMouseEvent) => {
      // Apenas botão esquerdo
      if ((e.originalEvent as MouseEvent).button !== 0) return;
      pressing = true;
      startX = e.point.x;
      startY = e.point.y;
      startT = Date.now();
    };
    const onUp = (e: mapboxgl.MapMouseEvent) => {
      if (!pressing) return;
      pressing = false;
      const dx = Math.abs(e.point.x - startX);
      const dy = Math.abs(e.point.y - startY);
      const dt = Date.now() - startT;
      if (dx + dy > CLICK_MAX_DIST || dt > CLICK_MAX_MS) return;

      const coord: RelatorioApsCoordenada = {
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      };
      if (modo === "linha") return onAdicionarPontoLinha(coord);
      if (modo === "area") return onAdicionarPontoArea(coord);
      if (modo === "adicionar") return onAdicionarMarcadorManual(coord);
      if (modo === "ajustar") {
        const feats = map.queryRenderedFeatures(e.point, {
          layers: [
            PONTOS_CIRCLE_LAYER_ID,
            RUAS_SYMBOL_LAYER_ID,
            MANUAIS_CIRCLE_LAYER_ID,
          ].filter((id) => !!map.getLayer(id)),
        });
        if (selecaoMarcador) {
          if (selecaoMarcador.tipo === "servico") {
            onAjustarPontoServico(selecaoMarcador.id, coord);
          } else if (selecaoMarcador.tipo === "rua") {
            onAjustarPontoRua(selecaoMarcador.id, coord);
          } else {
            onMoverMarcadorManual(selecaoMarcador.id, coord);
          }
          onLimparSelecao();
          return;
        }
        const f = feats[0];
        if (f && f.properties) {
          const tipo = f.properties.tipo as RelatorioApsTipoMarcador | undefined;
          const id = f.properties.id as string | undefined;
          if (tipo && id) onSelecionarMarcador(tipo, id);
        }
      }
    };

    map.on("mousedown", onDown);
    map.on("mouseup", onUp);
    return () => {
      map.off("mousedown", onDown);
      map.off("mouseup", onUp);
      canvas.style.cursor = "";
    };
  }, [
    modo,
    mapReady,
    selecaoMarcador,
    onAdicionarPontoLinha,
    onAdicionarPontoArea,
    onAdicionarMarcadorManual,
    onAjustarPontoServico,
    onAjustarPontoRua,
    onMoverMarcadorManual,
    onSelecionarMarcador,
    onLimparSelecao,
  ]);

  const semGps = pontosServico.length === 0 && pontosRua.length === 0;
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
  const handleFecharArea = () => {
    onFecharArea();
    setModo("idle");
  };
  const handleCancelarArea = () => {
    onCancelarArea();
    setModo("idle");
  };
  const handleConcluir = () => {
    setModo("idle");
    onLimparSelecao();
  };
  const handleIniciarAjustar = () => {
    setModo("ajustar");
  };
  const handleIniciarAdicionar = () => {
    onLimparSelecao();
    setModo("adicionar");
  };

  const totalAjustes =
    Object.keys(ajustesPontosServico).length +
    Object.keys(ajustesPontosRua).length +
    marcadoresManuais.length;

  const undoLinhaDisabled = linhaServico.length === 0;
  const undoAreaDisabled = (areaEmEdicao?.length ?? 0) === 0;

  const modoAtivoLabel: Record<Exclude<Modo, "idle">, string> = {
    linha: "Traçado",
    area: "Área",
    ajustar: "Ajustar marcadores",
    adicionar: "Adicionar marcador",
  };
  const modoAtivoHelp: Record<Exclude<Modo, "idle">, string> = {
    linha: "Clique no mapa para adicionar pontos ao traçado.",
    area: "Clique no mapa para adicionar vértices. Com 3+ pontos, use “Fechar área”.",
    ajustar: selecaoMarcador
      ? "Marcador selecionado. Clique no mapa para movê-lo para a nova posição."
      : "Clique sobre um marcador (numerado ou de rua) para selecioná-lo.",
    adicionar: "Clique no mapa para adicionar um marcador numerado manual.",
  };

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

      {modo === "idle" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleToggleLinha}
            disabled={!mapReady}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Traçado
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleToggleArea}
            disabled={!mapReady}
          >
            <Shapes className="h-4 w-4 mr-1" />
            Área
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={!mapReady}>
                <MapPin className="h-4 w-4 mr-1" />
                Marcadores
                <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleIniciarAdicionar}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar marcador numerado
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleIniciarAjustar}>
                <Move className="h-4 w-4 mr-2" />
                Ajustar marcadores
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onResetarAjustes}
                disabled={totalAjustes === 0}
                className="text-destructive focus:text-destructive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar ajustes e manuais
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Pontos de rua</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={mostrarPontosRua}
                onCheckedChange={(v) => onSetMostrarPontosRua(!!v)}
              >
                Mostrar no mapa
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={incluirPontosRuaNoPdf}
                onCheckedChange={(v) => onSetIncluirPontosRuaNoPdf(!!v)}
              >
                Incluir no PDF
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  !mapReady ||
                  (linhaServico.length === 0 &&
                    areasAplicacao.length === 0 &&
                    !editandoArea)
                }
              >
                <MoreHorizontal className="h-4 w-4 mr-1" />
                Limpar
                <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={onLimparLinha}
                disabled={linhaServico.length === 0}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar traçado
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onLimparAreas}
                disabled={areasAplicacao.length === 0 && !editandoArea}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar áreas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {linhaServico.length} traçado · {areasAplicacao.length} área
            {areasAplicacao.length === 1 ? "" : "s"} · {marcadoresManuais.length} manual
            {marcadoresManuais.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Modo — {modoAtivoLabel[modo]}
          </span>
          <span className="text-xs text-muted-foreground">{modoAtivoHelp[modo]}</span>

          {modo === "linha" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDesfazerLinha}
              disabled={undoLinhaDisabled}
              className="ml-2"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Desfazer
            </Button>
          )}
          {modo === "area" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onDesfazerPontoArea}
                disabled={undoAreaDisabled}
                className="ml-2"
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Desfazer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleFecharArea}
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
                Cancelar
              </Button>
            </>
          )}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleConcluir}
            className="ml-auto"
          >
            <Check className="h-4 w-4 mr-1" />
            Concluir
          </Button>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-[420px] rounded-md border bg-muted overflow-hidden"
      />

      {marcadoresManuais.length > 0 && (
        <div className="rounded-md border p-2">
          <p className="text-xs font-medium mb-1">Marcadores manuais</p>
          <ul className="flex flex-wrap gap-1.5">
            {marcadoresManuais
              .slice()
              .sort((a, b) => a.sequencia - b.sequencia)
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-1 rounded border bg-muted/40 px-2 py-0.5 text-xs"
                >
                  <span className="font-semibold">#{m.sequencia}</span>
                  <button
                    type="button"
                    onClick={() => onRemoverMarcadorManual(m.id)}
                    className="text-destructive hover:text-destructive/80"
                    title="Remover marcador manual"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {!tokenReady && (
        <p className="text-xs text-muted-foreground">Carregando mapa…</p>
      )}
    </div>
  );
});

export default RelatorioApsMapa;
