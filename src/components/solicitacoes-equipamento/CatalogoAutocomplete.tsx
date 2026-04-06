import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalogosDropdown } from "@/services/catalogoEquipamentoService";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search } from "lucide-react";

interface CatalogoOption {
  id: string;
  descricao_padrao: string | null;
  imagem_url: string | null;
  capacidade: string | null;
  fabricante_nome: string | null;
  modelo_nome: string | null;
  tipo_nome: string | null;
}

interface Props {
  value: string;
  onChange: (id: string, catalogo: CatalogoOption | null) => void;
  placeholder?: string;
}

const CatalogoAutocomplete: React.FC<Props> = ({ value, onChange, placeholder = "Buscar no catálogo..." }) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: catalogos = [] } = useQuery<CatalogoOption[]>({
    queryKey: ["catalogos-autocomplete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_catalogo_equipamentos")
        .select(`
          id,
          descricao_padrao,
          imagem_url,
          capacidade,
          fabricante:bd_fabricantes(nome),
          modelo:bd_modelos(nome_modelo),
          tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)
        `)
        .eq("ativo", true)
        .order("descricao_padrao");
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        descricao_padrao: item.descricao_padrao,
        imagem_url: item.imagem_url,
        capacidade: item.capacidade,
        fabricante_nome: item.fabricante?.nome || null,
        modelo_nome: item.modelo?.nome_modelo || null,
        tipo_nome: item.tipo_equipamento?.descricao_padronizada || null,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!search) return catalogos;
    const s = search.toLowerCase();
    return catalogos.filter((c) =>
      [c.descricao_padrao, c.fabricante_nome, c.modelo_nome, c.tipo_nome, c.capacidade]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s))
    );
  }, [catalogos, search]);

  const selected = useMemo(
    () => catalogos.find((c) => c.id === value),
    [catalogos, value]
  );

  return (
    <div className="relative">
      {selected && !isOpen ? (
        <div
          className="flex items-center gap-3 border rounded-md p-2 cursor-pointer hover:bg-muted/50"
          onClick={() => setIsOpen(true)}
        >
          {selected.imagem_url ? (
            <img src={selected.imagem_url} className="w-10 h-10 rounded object-cover" alt="" />
          ) : (
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {selected.descricao_padrao || selected.tipo_nome || "Sem descrição"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[selected.fabricante_nome, selected.modelo_nome, selected.capacidade].filter(Boolean).join(" • ")}
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange("", null);
              setSearch("");
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>
      )}

      {isOpen && !selected && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
          <ScrollArea className="max-h-[240px]">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Nenhum item encontrado</div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    onChange(c.id, c);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {c.imagem_url ? (
                    <img src={c.imagem_url} className="w-10 h-10 rounded object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.descricao_padrao || c.tipo_nome || "Sem descrição"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.fabricante_nome, c.modelo_nome, c.capacidade].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default CatalogoAutocomplete;
