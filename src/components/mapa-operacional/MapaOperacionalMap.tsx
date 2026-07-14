import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useGeocoding } from "@/hooks/useGeocoding";
import {
  STATUS_COLORS,
  type MapaOperacionalAtivo,
} from "@/services/mapa-operacional/mapaOperacionalService";

const SOURCE_ID = "mapa-op-src";
const CLUSTER_LAYER = "mapa-op-cluster";
const CLUSTER_COUNT_LAYER = "mapa-op-cluster-count";
const POINTS_LAYER = "mapa-op-points";
const HALO_LAYER = "mapa-op-halo";
const RJ_CENTER: [number, number] = [-43.1729, -22.9068];

interface Props {
  ativos: MapaOperacionalAtivo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  fitOnce?: boolean;
}

export function MapaOperacionalMap({ ativos, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const didInitialFitRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const { getPublicToken } = useGeocoding();

  const featureCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: ativos
        .filter(
          (a) =>
            Number.isFinite(a.latitude) &&
            Number.isFinite(a.longitude) &&
            !(a.latitude === 0 && a.longitude === 0),
        )
        .map((a) => ({
          type: "Feature" as const,
          properties: {
            id: a.equipamento_id,
            status: a.status_mapa,
            color: STATUS_COLORS[a.status_mapa].mapboxColor,
            label:
              a.frota || a.numero_frota
                ? `${a.frota ?? ""}${a.numero_frota ? " " + a.numero_frota : ""}`.trim()
                : a.placa || "—",
          },
          geometry: {
            type: "Point" as const,
            coordinates: [a.longitude, a.latitude],
          },
        })),
    }),
    [ativos],
  );

  // init map (uma vez)
  useEffect(() => {
    let cancelled = false;
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
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      try {
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      } catch {
        /* noop */
      }

      map.on("load", () => {
        if (!mapRef.current) return;
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 45,
        });

        map.addLayer({
          id: HALO_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ""]],
          paint: {
            "circle-radius": 18,
            "circle-color": "#DD2C00",
            "circle-opacity": 0.25,
            "circle-stroke-color": "#DD2C00",
            "circle-stroke-width": 2,
          },
        });

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
        map.addLayer({
          id: CLUSTER_COUNT_LAYER,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 13,
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: POINTS_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

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

        map.on("click", POINTS_LAYER, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onSelectRef.current(id);
        });
        const setPointer = () => (map.getCanvas().style.cursor = "pointer");
        const resetPointer = () => (map.getCanvas().style.cursor = "");
        map.on("mouseenter", POINTS_LAYER, setPointer);
        map.on("mouseleave", POINTS_LAYER, resetPointer);
        map.on("mouseenter", CLUSTER_LAYER, setPointer);
        map.on("mouseleave", CLUSTER_LAYER, resetPointer);

        readyRef.current = true;
      });

      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
      didInitialFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update source data (não reconstrói o mapa)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(featureCollection);

      // Enquadra apenas na primeira carga com pelo menos 1 feature.
      if (!didInitialFitRef.current && featureCollection.features.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        featureCollection.features.forEach((f) =>
          bounds.extend(f.geometry.coordinates as [number, number]),
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
        didInitialFitRef.current = true;
      }
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [featureCollection]);

  // Resize map whenever its container size changes (sidebar toggle, panel toggle, breakpoint)
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

  // halo do selecionado (sem reconstruir mapa)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    try {
      map.setFilter(HALO_LAYER, [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "id"], selectedId ?? ""],
      ]);
    } catch {
      /* noop */
    }
    if (!selectedId) return;
    const feat = featureCollection.features.find((f) => f.properties.id === selectedId);
    if (!feat) return;
    const coords = feat.geometry.coordinates as [number, number];
    map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 14), duration: 600 });
  }, [selectedId, featureCollection]);

  return <div ref={containerRef} className="w-full h-full" />;
}
