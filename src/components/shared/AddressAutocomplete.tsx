import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Crosshair,
  XCircle,
  Info,
} from "lucide-react";
import { useGeocoding, type GeocodeFeature, type GeocodingOpts } from "@/hooks/useGeocoding";
import MapAdjustModal from "./MapAdjustModal";
import { rankAddressResults, type RankContext } from "@/utils/geocoding/rankAddressResults";

export interface AddressResult {
  endereco_completo: string;
  latitude: number;
  longitude: number;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  geocoding_status: "auto" | "manual" | "aproximado" | "erro";
  geocoding_source: "cache" | "mapbox" | "manual";
  geocoding_relevance?: number;
  endereco_normalizado?: string;
  mapbox_place_name?: string;
}

interface AddressAutocompleteProps {
  value?: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialStatus?: AddressResult["geocoding_status"] | null;
  onAddressSelected: (result: AddressResult) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Contexto operacional opcional para melhorar a busca (proximity/UF/cidade/bairro).
   * Sem context, comportamento atual é preservado (nenhuma tela existente regride).
   */
  context?: RankContext;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value = "",
  initialLatitude,
  initialLongitude,
  initialStatus,
  onAddressSelected,
  disabled = false,
  placeholder = "Digite o endereço...",
  context,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [emptyByCityFilter, setEmptyByCityFilter] = useState(false);
  const [status, setStatus] = useState<AddressResult["geocoding_status"] | null>(
    initialStatus ?? null
  );
  const [mapOpen, setMapOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [lastResolvedCoords, setLastResolvedCoords] = useState<{ lat: number; lng: number } | null>(
    initialLatitude != null && initialLongitude != null
      ? { lat: initialLatitude, lng: initialLongitude }
      : null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastResolvedQueryRef = useRef<string>(value || "");
  const selectedFromListRef = useRef<boolean>(!!initialStatus);
  const { autocomplete, geocode, loading } = useGeocoding();

  // Monta query enriquecida quando há context e usuário não usou vírgula
  const buildEnrichedQuery = useCallback(
    (raw: string): string => {
      if (!context) return raw;
      if (raw.includes(",")) return raw;
      const parts = [
        raw.trim(),
        context.bairro?.trim(),
        context.cidade?.trim(),
        context.uf?.trim(),
        "Brasil",
      ].filter((p): p is string => !!p && p.length > 0);
      return parts.join(", ");
    },
    [context]
  );

  const buildOpts = useCallback((): GeocodingOpts | undefined => {
    if (!context) return undefined;
    const opts: GeocodingOpts = {};
    if (context.proximity) opts.proximity = context.proximity;
    if (context.bbox) opts.bbox = context.bbox;
    opts.types = "address,street,place,locality,neighborhood";
    opts.limit = 8;
    return opts;
  }, [context]);


  useEffect(() => {
    setQuery(value);
    lastResolvedQueryRef.current = value || "";
  }, [value]);

  useEffect(() => {
    if (initialStatus !== undefined) setStatus(initialStatus);
    selectedFromListRef.current = !!initialStatus;
  }, [initialStatus]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.trim().length < 3) {
        setSuggestions([]);
        setEmptyByCityFilter(false);
        return;
      }
      const enriched = buildEnrichedQuery(q);
      const opts = buildOpts();
      const features = await autocomplete(enriched, opts);
      const ranked = context
        ? rankAddressResults(features, context)
        : { features, filteredOutOfCity: false, filteredOutOfUf: false };
      setSuggestions(ranked.features);
      setEmptyByCityFilter(
        (ranked.filteredOutOfCity || ranked.filteredOutOfUf) && features.length > 0
      );
      setShowDropdown(
        ranked.features.length > 0 || ranked.filteredOutOfCity || ranked.filteredOutOfUf
      );
    },
    [autocomplete, buildEnrichedQuery, buildOpts, context]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setStatus(null);
    selectedFromListRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 350);
  };


  const emitFromFeature = (f: GeocodeFeature, q: string) => {
    const ctx = f.context || {};
    const newStatus: AddressResult["geocoding_status"] = (f.geocoding_status || "auto");
    const result: AddressResult = {
      endereco_completo: f.place_name || q,
      longitude: f.center[0],
      latitude: f.center[1],
      endereco_rua: f.text || "",
      endereco_numero: f.address || "",
      endereco_bairro: ctx.bairro || "",
      endereco_cidade: ctx.cidade || "",
      endereco_estado: ctx.estado || "",
      endereco_cep: ctx.cep || "",
      geocoding_status: newStatus,
      geocoding_source: (f.source as any) || "mapbox",
      geocoding_relevance: f.relevance,
      endereco_normalizado: f.endereco_normalizado,
      mapbox_place_name: f.place_name,
    };
    setStatus(newStatus);
    setLastResolvedCoords({ lat: f.center[1], lng: f.center[0] });
    onAddressSelected(result);
    return newStatus;
  };

  const handleSelect = (f: GeocodeFeature) => {
    const newStatus = emitFromFeature(f, f.place_name);
    setQuery(f.place_name);
    lastResolvedQueryRef.current = f.place_name;
    selectedFromListRef.current = true;
    setShowDropdown(false);
    if (newStatus === "aproximado") setMapOpen(true);
  };

  const handleBlur = async () => {
    // pequeno delay para permitir clique em sugestão
    setTimeout(async () => {
      if (!query || query.trim().length < 3) return;
      if (selectedFromListRef.current) return;
      if (query === lastResolvedQueryRef.current) return;
      if (resolving) return;

      setShowDropdown(false);
      setResolving(true);
      try {
        const f = await geocode(buildEnrichedQuery(query), buildOpts());
        if (!f || !f.center || f.geocoding_status === "erro") {
          setStatus("erro");
          lastResolvedQueryRef.current = query;
          setMapOpen(true);
          return;
        }
        const newStatus = emitFromFeature(f, query);
        lastResolvedQueryRef.current = query;
        if (newStatus === "aproximado") {
          // mantém badge amarelo, mostra botão (já visível) — não abre modal automaticamente
        }
      } finally {
        setResolving(false);
      }
    }, 150);
  };

  const handleManualConfirm = (r: import("./MapAdjustModal").MapAdjustResult) => {
    const result: AddressResult = {
      endereco_completo: r.endereco_completo || query,
      latitude: r.latitude,
      longitude: r.longitude,
      endereco_rua: r.endereco_rua,
      endereco_numero: r.endereco_numero,
      endereco_bairro: r.endereco_bairro,
      endereco_cidade: r.endereco_cidade,
      endereco_estado: r.endereco_estado,
      endereco_cep: r.endereco_cep,
      geocoding_status: "manual",
      geocoding_source: "manual",
      geocoding_relevance: r.geocoding_relevance,
    };
    if (r.endereco_completo) {
      setQuery(r.endereco_completo);
      lastResolvedQueryRef.current = r.endereco_completo;
    } else {
      lastResolvedQueryRef.current = query;
    }
    setStatus("manual");
    selectedFromListRef.current = true;
    setLastResolvedCoords({ lat: r.latitude, lng: r.longitude });
    onAddressSelected(result);
  };

  const renderBadge = () => {
    if (!status && !query) return null;
    switch (status) {
      case "auto":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Endereço validado automaticamente
          </Badge>
        );
      case "manual":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <Crosshair className="h-3 w-3" /> Posição confirmada manualmente
          </Badge>
        );
      case "aproximado":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <AlertCircle className="h-3 w-3" /> Aproximado — confirme no mapa
          </Badge>
        );
      case "erro":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
            <XCircle className="h-3 w-3" /> Endereço não encontrado — ajuste no mapa
          </Badge>
        );
      default:
        return query.length > 0 ? (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
            <Info className="h-3 w-3" /> Saia do campo ou ajuste no mapa para validar
          </Badge>
        ) : null;
    }
  };

  return (
    <div ref={wrapperRef} className="relative space-y-1.5">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
            >
              <div className="flex items-start gap-2">
                <MapPin
                  className={
                    "h-3.5 w-3.5 mt-0.5 shrink-0 " +
                    (s.geocoding_status === "auto"
                      ? "text-green-600"
                      : s.geocoding_status === "aproximado"
                      ? "text-amber-600"
                      : "text-muted-foreground")
                  }
                />
                <div className="flex-1">
                  <div>{s.place_name}</div>
                  {s.geocoding_status === "aproximado" && (
                    <div className="text-[10px] text-amber-600 mt-0.5">
                      Aproximado · exigirá ajuste no mapa
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && suggestions.length === 0 && emptyByCityFilter && (
        <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg p-3 text-xs text-muted-foreground">
          Não encontramos esse logradouro dentro da cidade selecionada. Complete o
          bairro/CEP ou ajuste manualmente no mapa.
        </div>
      )}


      <div className="flex items-center justify-between gap-2 flex-wrap">
        {renderBadge()}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setMapOpen(true)}
          disabled={disabled}
        >
          <Crosshair className="h-3 w-3" />
          Ajustar no mapa
        </Button>
      </div>

      <MapAdjustModal
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialLatitude={lastResolvedCoords?.lat ?? initialLatitude}
        initialLongitude={lastResolvedCoords?.lng ?? initialLongitude}
        initialAddress={query}
        onConfirm={handleManualConfirm}
      />
    </div>
  );
};

export default AddressAutocomplete;
