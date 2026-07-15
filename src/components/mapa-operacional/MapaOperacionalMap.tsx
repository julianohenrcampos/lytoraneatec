import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import { useGeocoding } from "@/hooks/useGeocoding";
import { type MapaOperacionalAtivo } from "@/services/mapa-operacional/mapaOperacionalService";
import {
  buildFeatureCollection,
  buildMapaOperacionalPopupDom,
  fitFeatureCollection,
  loadMachineIcon,
  type MapaOpFeatureCollection,
  type MapaOpFeatureProps,
} from "./mapaOperacionalGeo";

const SOURCE_ID = "mapa-op-src";
const HALO_LAYER = "mapa-op-halo";
const CLUSTER_LAYER = "mapa-op-cluster";
const CLUSTER_COUNT_LAYER = "mapa-op-cluster-count";
const POINTS_BASE_LAYER = "mapa-op-points-base";
const POINTS_ICON_LAYER = "mapa-op-points-icon";
const HITBOX_LAYER = "mapa-op-hitbox";
const MACHINE_ICON_ID = "mapa-op-machine";
const RJ_CENTER: [number, number] = [-43.1729, -22.9068];

interface Props {
  ativos: MapaOperacionalAtivo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDescartados?: (n: number) => void;
}

export function MapaOperacionalMap({ ativos, selectedId, onSelect, onDescartados }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const didInitialFitRef = useRef(false);
  const pendingDataRef = useRef<MapaOpFeatureCollection | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDescartadosRef = useRef(onDescartados);
  onDescartadosRef.current = onDescartados;

  const { getPublicToken } = useGeocoding();

  const { featureCollection, descartados } = useMemo(
    () => buildFeatureCollection(ativos),
    [ativos],
  );

  useEffect(() => {
    onDescartadosRef.current?.(descartados.length);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[MapaOperacional] atualização", {
        recebidos: ativos.length,
        features: featureCollection.features.length,
        descartados,
      });
    }
  }, [ativos.length, featureCollection.features.length, descartados]);

  // ---- init map (uma vez) ----
  useEffect(() => {
    let cancelled = false;

    const setupMap = async (map: mapboxgl.Map) => {
      // 1. Ícone (com fallback silencioso)
      if (!map.hasImage(MACHINE_ICON_ID)) {
        try {
          const img = await loadMachineIcon();
          if (!map.hasImage(MACHINE_ICON_ID)) {
            map.addImage(MACHINE_ICON_ID, img, { sdf: true });
          }
        } catch (e) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn("[MapaOperacional] falha ao registrar ícone de máquina", e);
          }
        }
      }

      // 2. Source
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 45,
        });
      }

      // 3. Halo
      if (!map.getLayer(HALO_LAYER)) {
        map.addLayer({
          id: HALO_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "equipamento_id"], ""],
          ],
          paint: {
            "circle-radius": 22,
            "circle-color": "#DD2C00",
            "circle-opacity": 0.2,
            "circle-stroke-color": "#DD2C00",
            "circle-stroke-width": 2,
          },
        });
      }

      // 4. Clusters
      if (!map.getLayer(CLUSTER_LAYER)) {
        map.addLayer({
          id: CLUSTER_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#DD2C00",
            "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
          },
        });
      }
      if (!map.getLayer(CLUSTER_COUNT_LAYER)) {
        map.addLayer({
          id: CLUSTER_COUNT_LAYER,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          layout: { "text-field": "{point_count_abbreviated}", "text-size": 13 },
          paint: { "text-color": "#ffffff" },
        });
      }

      // 5. Base colorida
      if (!map.getLayer(POINTS_BASE_LAYER)) {
        map.addLayer({
          id: POINTS_BASE_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "status_color"],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8, 8,
              12, 12,
              16, 18,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      // 6. Ícone
      if (!map.getLayer(POINTS_ICON_LAYER)) {
        map.addLayer({
          id: POINTS_ICON_LAYER,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": MACHINE_ICON_ID,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8, 0.5,
              12, 0.7,
              16, 1,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
          paint: { "icon-color": "#ffffff" },
        });
      }

      // 7. Hitbox invisível (eventos)
      if (!map.getLayer(HITBOX_LAYER)) {
        map.addLayer({
          id: HITBOX_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 24, "circle-color": "#000", "circle-opacity": 0 },
        });
      }

      // 8. Eventos
      map.on("click", CLUSTER_LAYER, (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
        const clusterId = feats[0]?.properties?.cluster_id;
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (clusterId != null && src) {
          src.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            const coords = (feats[0].geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coords, zoom: zoom ?? map.getZoom() + 2 });
          });
        }
      });

      const showPopup = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const props = f.properties as unknown as MapaOpFeatureProps;
        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            className: "mapa-op-popup",
          });
        }
        hoverPopupRef.current
          .setLngLat(coords)
          .setDOMContent(buildMapaOperacionalPopupDom(props))
          .addTo(map);
      };
      const hidePopup = () => {
        map.getCanvas().style.cursor = "";
        hoverPopupRef.current?.remove();
      };

      map.on("mouseenter", HITBOX_LAYER, showPopup);
      map.on("mouseleave", HITBOX_LAYER, hidePopup);

      map.on("click", HITBOX_LAYER, (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.equipamento_id as string | undefined;
        hoverPopupRef.current?.remove();
        if (id) onSelectRef.current(id);
      });

      // cluster cursor
      map.on("mouseenter", CLUSTER_LAYER, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", CLUSTER_LAYER, () => (map.getCanvas().style.cursor = ""));

      readyRef.current = true;

      // Aplica dados pendentes
      const pending = pendingDataRef.current;
      if (pending) {
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        src?.setData(pending);
        if (!didInitialFitRef.current && pending.features.length > 0) {
          fitFeatureCollection(map, pending);
          didInitialFitRef.current = true;
        }
      }
    };

    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const token = await getPublicToken();
      if (!token || cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: RJ_CENTER,
        zoom: 9,
      });
      // Atribui ANTES do handler load para não perder o evento
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      try {
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      } catch {
        /* noop */
      }

      if (import.meta.env.DEV) {
        map.on("error", (e) => {
          // eslint-disable-next-line no-console
          console.warn("[MapaOperacional] mapbox error", e?.error?.message ?? e);
        });
      }

      if (map.isStyleLoaded()) {
        void setupMap(map);
      } else {
        map.once("load", () => {
          void setupMap(map);
        });
      }
    })();

    return () => {
      cancelled = true;
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
      didInitialFitRef.current = false;
      pendingDataRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- update source data ----
  useEffect(() => {
    pendingDataRef.current = featureCollection;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(featureCollection);
    if (!didInitialFitRef.current && featureCollection.features.length > 0) {
      fitFeatureCollection(map, featureCollection);
      didInitialFitRef.current = true;
    }
  }, [featureCollection]);

  // ---- resize on container change ----
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      try { map.resize(); } catch { /* noop */ }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- halo do selecionado ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    try {
      map.setFilter(HALO_LAYER, [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "equipamento_id"], selectedId ?? ""],
      ]);
    } catch {
      /* noop */
    }
    if (!selectedId) return;
    const feat = featureCollection.features.find((f) => f.properties.equipamento_id === selectedId);
    if (!feat) return;
    const coords = feat.geometry.coordinates as [number, number];
    map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 14), duration: 600 });
  }, [selectedId, featureCollection]);

  const handleEnquadrar = () => {
    const map = mapRef.current;
    if (!map) return;
    fitFeatureCollection(map, featureCollection);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {featureCollection.features.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10">
          <Button
            size="sm"
            variant="secondary"
            className="shadow"
            onClick={handleEnquadrar}
            title="Enquadrar ativos"
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Enquadrar ativos
          </Button>
        </div>
      )}
    </div>
  );
}
