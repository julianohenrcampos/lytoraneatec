
"use client"

import { useState, useEffect } from "react"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { Loader2, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

type Caminhao = {
  id: string
  nome_caminhao: string
  termo_busca: string // concatenação para busca
}

interface ComboboxCaminhaoProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  includeEquipamentos?: boolean
  situacaoFilter?: string[]
}

export function ComboboxCaminhao({
  value,
  onChange,
  placeholder = "Selecione um veículo",
  disabled = false,
  includeEquipamentos = false,
  situacaoFilter = ["Operando", "Em Manutenção", "Disponível", "Intempérie"]
}: ComboboxCaminhaoProps) {
  const [open, setOpen] = useState(false)
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  // Find the selected vehicle
  const selectedVehicle = caminhoes.find(item => item.id === value);

  useEffect(() => {
    if (open || value) {
      fetchCaminhoes()
    }
  }, [open, includeEquipamentos, situacaoFilter, value])

  async function fetchCaminhoes() {
    if (caminhoes.length > 0 && !value) return; // Skip if already loaded and no specific value needed

    setLoading(true)
    try {
      console.log("Fetching vehicles with filters:", { includeEquipamentos, situacaoFilter });
      let query = supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, frota, numero_frota, placa")
        
      // Apply vehicle type filter
      if (!includeEquipamentos) {
        query = query.eq("tipo_veiculo", "Caminhão");
      }
      
      // Apply situation filter if provided
      if (situacaoFilter && situacaoFilter.length > 0) {
        query = query.in("situacao", situacaoFilter);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar veículos:", error)
        return
      }

      const formatados = (data || []).map((item) => {
        const nome = `${item.frota || ''}${item.numero_frota || ''} - ${item.placa || ''}`.trim()
        const termo_busca = `${item.frota || ''}${item.numero_frota || ''}`.toLowerCase()
        return {
          id: item.id,
          nome_caminhao: nome,
          termo_busca,
        }
      }).sort((a, b) => a.nome_caminhao.localeCompare(b.nome_caminhao))

      console.log(`Loaded ${formatados.length} vehicles`);
      setCaminhoes(formatados)
    } catch (error) {
      console.error("Erro ao buscar veículos:", error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = search === "" 
    ? caminhoes 
    : caminhoes.filter((item) =>
        item.termo_busca.includes(search.toLowerCase()) ||
        item.nome_caminhao.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", disabled && "opacity-50 cursor-not-allowed")}
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
        >
          {selectedVehicle ? selectedVehicle.nome_caminhao : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar veículo (ex: RJN01)..."
            value={search}
            onValueChange={setSearch}
            className="h-9 flex-1"
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Carregando veículos...
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-sm">Nenhum veículo encontrado.</CommandEmpty>
            ) : (
              filtered.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onChange(item.id);
                    setSearch("");
                    setOpen(false);
                  }}
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground py-3"
                >
                  {item.nome_caminhao}
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
