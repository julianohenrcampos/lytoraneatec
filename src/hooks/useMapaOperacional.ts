import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMapaOperacional,
  type MapaOperacionalFiltros,
} from "@/services/mapa-operacional/mapaOperacionalService";

/**
 * Hook único que alimenta mapa, painel lateral e indicadores.
 * - staleTime 30s, refetchInterval 60s
 * - pausa quando document.visibilityState = 'hidden'
 */
export function useMapaOperacional(filtros: MapaOperacionalFiltros) {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return useQuery({
    queryKey: ["mapa-operacional", filtros],
    queryFn: () => fetchMapaOperacional(filtros),
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
