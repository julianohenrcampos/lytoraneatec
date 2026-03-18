import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}

interface AddressAutocompleteProps {
  value?: string;
  isValidated?: boolean;
  onAddressSelected: (result: AddressResult) => void;
  disabled?: boolean;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value = "",
  isValidated = false,
  onAddressSelected,
  disabled = false,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [validated, setValidated] = useState(isValidated);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setValidated(isValidated);
  }, [isValidated]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-proxy", {
        body: { query: q },
      });
      if (error) throw error;
      setSuggestions(data?.features || []);
      setShowDropdown(true);
    } catch (err) {
      console.error("Erro ao buscar endereços:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setValidated(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (feature: any) => {
    const result: AddressResult = {
      endereco_completo: feature.place_name,
      longitude: feature.center[0],
      latitude: feature.center[1],
      endereco_rua: feature.text || "",
      endereco_numero: feature.address || "",
      endereco_bairro: feature.context?.bairro || "",
      endereco_cidade: feature.context?.cidade || "",
      endereco_estado: feature.context?.estado || "",
      endereco_cep: feature.context?.cep || "",
    };
    setQuery(feature.place_name);
    setShowDropdown(false);
    setValidated(true);
    onAddressSelected(result);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-1.5">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Digite o endereço da obra..."
          value={query}
          onChange={handleInputChange}
          disabled={disabled}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown de sugestões */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
              onClick={() => handleSelect(s)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{s.place_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Feedback visual */}
      {validated ? (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Endereço validado com sucesso
        </Badge>
      ) : query.length > 0 ? (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <AlertCircle className="h-3 w-3" />
          Selecione um endereço da lista para validar
        </Badge>
      ) : null}
    </div>
  );
};

export default AddressAutocomplete;
