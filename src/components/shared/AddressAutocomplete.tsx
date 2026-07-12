import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Crosshair,
  Info,
  Globe,
} from "lucide-react";
import { useGeocoding, type GeocodeFeature, type GeocodingOpts } from "@/hooks/useGeocoding";
import MapAdjustModal from "./MapAdjustModal";
import { rankAddressResults, type RankContext } from "@/utils/geocoding/rankAddressResults";

export type AddressSearchScope = "perto_de_mim" | "perto_da_obra" | "todo_rj";

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
  context?: RankContext;
  onUseCurrentLocation?: () => void;
  /** Kept for backward compatibility; no longer rendered as a separate CTA. */
  onUseTypedText?: (text: string) => void;
  /** M7-D: modo de busca controlado pelo pai. */
  searchScope?: AddressSearchScope;
  onSearchScopeChange?: (s: AddressSearchScope) => void;
  availableScopes?: { pertoDeMim: boolean; pertoDaObra: boolean };
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
  onUseCurrentLocation,
  onUseTypedText,
  searchScope,
  onSearchScopeChange,
  availableScopes,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedToRj, setExpandedToRj] = useState(false);
  const [noSuggestions, setNoSuggestions] = useState(false);
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

  const effectiveScope: AddressSearchScope = searchScope ?? "todo_rj";

  const buildEnrichedQuery = useCallback((raw: string): string => {
    return raw.trim();
  }, []);

  // M7-D: monta opts a partir do context + escopo. "todo_rj" NUNCA envia bbox.
  const buildOpts = useCallback(
    (scope: AddressSearchScope, dropBbox = false): GeocodingOpts => {
      const opts: GeocodingOpts = {
        country: "br",
        types: "address,place,locality,neighborhood",
        limit: 8,
      };
      if (context?.proximity) opts.proximity = context.proximity;
      if (!dropBbox && scope !== "todo_rj" && context?.bbox) opts.bbox = context.bbox;
      return opts;
    },
    [context]
  );


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
        setExpandedToRj(false);
        setNoSuggestions(false);
        return;
      }
      const enriched = buildEnrichedQuery(q);
      let features = await autocomplete(enriched, buildOpts(effectiveScope));
      let expanded = false;

      // M7-D: fallback automático — sem resultados no escopo local → refaz sem bbox.
      if (features.length === 0 && effectiveScope !== "todo_rj") {
        features = await autocomplete(enriched, buildOpts(effectiveScope, true));
        if (features.length > 0) expanded = true;
      }

      const ranked = context
        ? rankAddressResults(features, context)
        : { features, filteredOutOfCity: false, filteredOutOfUf: false };

      setSuggestions(ranked.features);
      setExpandedToRj(expanded);
      setNoSuggestions(ranked.features.length === 0);
      setShowDropdown(ranked.features.length > 0);
    },
    [autocomplete, buildEnrichedQuery, buildOpts, context, effectiveScope]
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
    const newStatus: AddressResult["geocoding_status"] = f.geocoding_status || "auto";
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
    emitFromFeature(f, f.place_name);
    setQuery(f.place_name);
    lastResolvedQueryRef.current = f.place_name;
    selectedFromListRef.current = true;
    setShowDropdown(false);
    setNoSuggestions(false);
    setExpandedToRj(false);
  };

  const handleBlur = () => {
    // M7-D: apenas resolve silenciosamente coordenada quando o usuário sai do campo com texto novo.
    // Nunca marca "erro" agressivo; aviso neutro é responsável por comunicar falta de sugestão.
    setTimeout(async () => {
      if (!query || query.trim().length < 3) return;
      if (selectedFromListRef.current) return;
      if (query === lastResolvedQueryRef.current) return;
      if (resolving) return;

      setShowDropdown(false);
      setResolving(true);
      try {
        const f = await geocode(buildEnrichedQuery(query), buildOpts(effectiveScope, true));
        lastResolvedQueryRef.current = query;
        if (!f || !f.center || f.geocoding_status === "erro") {
          setNoSuggestions(true);
          return;
        }
        emitFromFeature(f, query);
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
    setNoSuggestions(false);
    onAddressSelected(result);
  };

  const renderBadge = () => {
    if (!status) return null;
    switch (status) {
      case "auto":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Validado automaticamente
          </Badge>
        );
      case "manual":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <Crosshair className="h-3 w-3" /> Confirmado no mapa
          </Badge>
        );
      case "aproximado":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <AlertCircle className="h-3 w-3" /> Aproximado — confirme no mapa
          </Badge>
        );
      default:
        return null;
    }
  };

  const scopeCtl = useMemo(
    () => ({
      pertoDeMim: availableScopes?.pertoDeMim ?? false,
      pertoDaObra: availableScopes?.pertoDaObra ?? false,
    }),
    [availableScopes]
  );

  const canConfirmMap = query.trim().length > 0 || !!lastResolvedCoords;

  return (
    <div ref={wrapperRef} className="relative space-y-2">
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

      {/* M7-D: seletor de escopo */}
      {onSearchScopeChange && (
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Buscar em:</span>
            <ToggleGroup
              type="single"
              size="sm"
              value={effectiveScope}
              onValueChange={(v) => v && onSearchScopeChange(v as AddressSearchScope)}
              className="gap-1"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <ToggleGroupItem
                      value="perto_de_mim"
                      disabled={!scopeCtl.pertoDeMim || disabled}
                      className="h-7 px-2 text-xs"
                    >
                      <Crosshair className="h-3 w-3 mr-1" />
                      Perto de mim
                    </ToggleGroupItem>
                  </span>
                </TooltipTrigger>
                {!scopeCtl.pertoDeMim && (
                  <TooltipContent>GPS atual indisponível</TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <ToggleGroupItem
                      value="perto_da_obra"
                      disabled={!scopeCtl.pertoDaObra || disabled}
                      className="h-7 px-2 text-xs"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Perto da obra
                    </ToggleGroupItem>
                  </span>
                </TooltipTrigger>
                {!scopeCtl.pertoDaObra && (
                  <TooltipContent>Centro de custo sem coordenada</TooltipContent>
                )}
              </Tooltip>
              <ToggleGroupItem value="todo_rj" disabled={disabled} className="h-7 px-2 text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Todo RJ
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </TooltipProvider>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {expandedToRj && (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/50 border-b flex items-center gap-1">
              <Globe className="h-3 w-3" /> Expandimos a busca para todo o RJ.
            </div>
          )}
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

      {/* M7-D: aviso neutro sem sugestões (sem CTA duplicado — a ação principal fica no rodapé) */}
      {noSuggestions &&
        !loading &&
        !resolving &&
        query.trim().length >= 3 &&
        !selectedFromListRef.current && (
          <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Não encontramos uma sugestão exata. Confirme o ponto no mapa.</span>
          </div>
        )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        {renderBadge()}
        <div className="ml-auto flex items-center gap-2">
          {onUseCurrentLocation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={onUseCurrentLocation}
              disabled={disabled}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Usar minha localização
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-3 text-xs gap-1"
            onClick={() => {
              if (query.trim() && onUseTypedText) onUseTypedText(query.trim());
              setMapOpen(true);
            }}
            disabled={disabled || !canConfirmMap}
          >
            <MapPin className="h-3.5 w-3.5" />
            Confirmar no mapa
          </Button>
        </div>
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
