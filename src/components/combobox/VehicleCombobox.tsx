
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { supabase } from "@/integrations/supabase/client"

export interface Vehicle {
  id: string
  nome_caminhao: string
}

export interface VehicleComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  onlyTrucks?: boolean
  situationFilter?: string[]
}

export function VehicleCombobox({
  value,
  onChange,
  placeholder = "Selecione um veículo",
  emptyText = "Nenhum veículo encontrado",
  searchPlaceholder = "Buscar veículo...",
  className,
  disabled = false,
  onlyTrucks = true,
  situationFilter = ["Operando", "Em Manutenção", "Disponível", "Intempérie"]
}: VehicleComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [loading, setLoading] = React.useState(false)

  // Find the selected vehicle
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === value);

  // Filter vehicles based on input value
  const filteredVehicles = React.useMemo(() => {
    if (!inputValue) return vehicles;
    
    return vehicles.filter((vehicle) => {
      return vehicle.nome_caminhao.toLowerCase().includes(inputValue.toLowerCase());
    });
  }, [vehicles, inputValue]);

  // Fetch vehicles from the database
  React.useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from("bd_caminhoes_equipamentos")
          .select(`
            id,
            frota,
            numero_frota,
            placa
          `);
          
        // Apply filters
        if (onlyTrucks) {
          query = query.eq("tipo_veiculo", "Caminhão");
        }
        
        if (situationFilter && situationFilter.length > 0) {
          query = query.in("situacao", situationFilter);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error("Error fetching vehicles:", error);
          return;
        }
        
        // Format the data according to the requirements
        const formattedVehicles = (data || [])
          .map((item) => ({
            id: item.id,
            nome_caminhao: `${item.frota || ''}${item.numero_frota || ''} - ${item.placa || ''}`.trim()
          }))
          .sort((a, b) => a.nome_caminhao.localeCompare(b.nome_caminhao));
        
        setVehicles(formattedVehicles);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, [onlyTrucks, situationFilter]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          onClick={() => setOpen(!open)}
        >
          {selectedVehicle ? selectedVehicle.nome_caminhao : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder={searchPlaceholder} 
              value={inputValue}
              onValueChange={setInputValue}
              className="h-9 flex-1"
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando veículos...
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                {filteredVehicles.map((vehicle) => (
                  <CommandItem
                    key={vehicle.id}
                    value={vehicle.id}
                    onSelect={() => {
                      onChange(vehicle.id);
                      setInputValue("");
                      setOpen(false);
                    }}
                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground py-3"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === vehicle.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {vehicle.nome_caminhao}
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
