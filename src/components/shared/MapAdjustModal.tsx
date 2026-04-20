import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Crosshair } from "lucide-react";
import { useGeocoding, type ReverseResult } from "@/hooks/useGeocoding";
import { toast } from "sonner";

export interface MapAdjustResult {
  latitude: number;
  longitude: number;
  endereco_completo?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  geocoding_status: "manual";
  geocoding_source: "manual";
  geocoding_relevance?: number;
}

interface MapAdjustModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialAddress?: string;
  onConfirm: (r: MapAdjustResult) => void;
}

const DEFAULT_CENTER: [number, number] = [-43.825, -22.85]; // Itaguaí (região operacional)

const MapAdjustModal: React.FC<MapAdjustModalProps> = ({
  open,
  onOpenChange,
  initialLatitude,
  initialLongitude,
  initialAddress,
  onConfirm,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(
    initialLatitude != null && initialLongitude != null
      ? [initialLongitude, initialLatitude]
      : null
  );
  const [reverseInfo, setReverseInfo] = useState<ReverseResult | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const { getPublicToken, reverse, loading } = useGeocoding();

  // Reset coords whenever modal opens (or initial coords change while open)
  useEffect(() => {
    if (!open) return;
    const next: [number, number] | null =
      initialLatitude != null && initialLongitude != null
        ? [initialLongitude, initialLatitude]
        : null;
    setCoords(next);
    setReverseInfo(null);

    // If map already exists (reopen), fly to new center
    if (mapRef.current) {
      const center = next ?? DEFAULT_CENTER;
      const zoom = next ? 16 : 12;
      mapRef.current.flyTo({ center, zoom });
      markerRef.current?.setLngLat(center);
    }
  }, [open, initialLatitude, initialLongitude]);

  // Initialize map
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const token = await getPublicToken();
      if (!token || cancelled) return;
      mapboxgl.accessToken = token;
      setTokenReady(true);

      // Wait next tick for container size
      setTimeout(() => {
        if (!containerRef.current || mapRef.current) return;
        const hasReal = initialLatitude != null && initialLongitude != null;
        const initial: [number, number] = hasReal
          ? [initialLongitude as number, initialLatitude as number]
          : DEFAULT_CENTER;
        mapRef.current = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: initial,
          zoom: hasReal ? 16 : 12,
        });
        mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

        // Always create a visible marker so the user has a reference point
        markerRef.current = new mapboxgl.Marker({ draggable: true, color: "#DD2C00" })
          .setLngLat(initial)
          .addTo(mapRef.current);

        markerRef.current.on("dragend", () => {
          const ll = markerRef.current!.getLngLat();
          setCoords([ll.lng, ll.lat]);
        });

        mapRef.current.on("click", (e) => {
          markerRef.current!.setLngLat(e.lngLat);
          setCoords([e.lngLat.lng, e.lngLat.lat]);
        });
      }, 50);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setTokenReady(false);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reverse geocode whenever coords change
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    (async () => {
      const r = await reverse(coords[1], coords[0]);
      if (!cancelled) setReverseInfo(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [coords, reverse]);

  const handleConfirm = () => {
    if (!coords) {
      toast.error("Selecione um ponto no mapa antes de confirmar");
      return;
    }
    onConfirm({
      latitude: coords[1],
      longitude: coords[0],
      endereco_completo: reverseInfo?.place_name || initialAddress,
      endereco_rua: reverseInfo?.endereco_rua,
      endereco_numero: reverseInfo?.endereco_numero,
      endereco_bairro: reverseInfo?.endereco_bairro,
      endereco_cidade: reverseInfo?.endereco_cidade,
      endereco_estado: reverseInfo?.endereco_estado,
      endereco_cep: reverseInfo?.endereco_cep,
      geocoding_status: "manual",
      geocoding_source: "manual",
      geocoding_relevance: reverseInfo?.relevance,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            Ajustar localização no mapa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Arraste o marcador ou clique no mapa para definir a posição exata.
            Após confirmar, o status do endereço será marcado como{" "}
            <strong className="text-foreground">manual</strong>.
          </p>

          <div
            ref={containerRef}
            className="w-full h-[440px] rounded-md border bg-muted"
          />

          {!tokenReady && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando mapa...
            </div>
          )}

          {coords && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">
                    {reverseInfo?.place_name || "Ponto selecionado"}
                  </div>
                  <div>
                    Lat: {coords[1].toFixed(6)} · Lng: {coords[0].toFixed(6)}
                  </div>
                </div>
              </div>
              {loading && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço...
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!coords}>
            Confirmar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MapAdjustModal;
