"use client"

import * as React from "react"
import { Check, Search, Users, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { FuncionarioPreConvocado } from "@/types/diarias"

interface FuncionarioItem {
  id: string;
  nome_completo: string;
  funcao_id: string;
  centro_custo_id?: string | null;
  bd_funcoes?: {
    id: string;
    nome_funcao: string;
    valor_diaria: number;
    valor_diaria_exclusiva: number | null;
    valor_refeicao: number | null;
  } | null;
}

interface CentroCustoItem {
  id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
}

interface SmartFuncionarioSearchProps {
  funcionarios: FuncionarioItem[];
  centrosCusto: CentroCustoItem[];
  convocadosPre: FuncionarioPreConvocado[];
  onSelectFuncionario: (id: string) => void;
  onSelectCentroCusto: (id: string) => void;
  disabled?: boolean;
}

export function SmartFuncionarioSearch({
  funcionarios,
  centrosCusto,
  convocadosPre,
  onSelectFuncionario,
  onSelectCentroCusto,
  disabled = false,
}: SmartFuncionarioSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const addedIds = React.useMemo(() => 
    new Set(convocadosPre.map(c => c.funcionario_id)), 
    [convocadosPre]
  );

  const filteredCentros = React.useMemo(() => {
    if (!inputValue || inputValue.length < 2) return [];
    const search = inputValue.toLowerCase();
    return centrosCusto.filter(cc =>
      cc.nome_centro_custo.toLowerCase().includes(search) ||
      cc.codigo_centro_custo.toLowerCase().includes(search)
    ).slice(0, 5);
  }, [centrosCusto, inputValue]);

  const filteredFuncionarios = React.useMemo(() => {
    if (!inputValue || inputValue.length < 2) return [];
    const search = inputValue.toLowerCase();
    return funcionarios.filter(f =>
      f.nome_completo.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [funcionarios, inputValue]);

  const handleSelectFuncionario = React.useCallback((funcId: string) => {
    onSelectFuncionario(funcId);
    setInputValue("");
    setOpen(false);
  }, [onSelectFuncionario]);

  const handleSelectCentroCusto = React.useCallback((ccId: string) => {
    onSelectCentroCusto(ccId);
    setInputValue("");
    setOpen(false);
  }, [onSelectCentroCusto]);

  const hasResults = filteredCentros.length > 0 || filteredFuncionarios.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start text-muted-foreground font-normal"
          disabled={disabled}
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          Buscar funcionário ou centro de custo...
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[10000] bg-popover shadow-xl border pointer-events-auto"
        align="start"
        side="bottom"
        sideOffset={4}
        style={{ minWidth: '350px' }}
      >
        <Command shouldFilter={false} className="pointer-events-auto">
          <div className="flex items-center border-b px-3 pointer-events-auto">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
            <input
              placeholder="Buscar funcionário ou centro de custo..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>
          <CommandList className="max-h-[350px] overflow-y-auto" style={{ pointerEvents: 'auto' }}>
            {inputValue.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Digite ao menos 2 caracteres para buscar...
              </div>
            ) : !hasResults ? (
              <CommandEmpty>Nenhum resultado encontrado</CommandEmpty>
            ) : (
              <>
                {filteredCentros.length > 0 && (
                  <CommandGroup heading="Centros de Custo">
                    {filteredCentros.map((cc) => {
                      const countInCc = funcionarios.filter(f => f.centro_custo_id === cc.id).length;
                      return (
                        <CommandItem
                          key={`cc-${cc.id}`}
                          value={`cc-${cc.id}`}
                          onSelect={() => handleSelectCentroCusto(cc.id)}
                          className="cursor-pointer py-2.5 px-3"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Users className="mr-2 h-4 w-4 shrink-0 text-primary" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{cc.codigo_centro_custo}</span>
                            <span className="text-muted-foreground"> — {cc.nome_centro_custo}</span>
                            {countInCc > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {countInCc} funcionário{countInCc !== 1 ? 's' : ''} ativo{countInCc !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {filteredFuncionarios.length > 0 && (
                  <CommandGroup heading="Funcionários">
                    {filteredFuncionarios.map((f) => {
                      const isAdded = addedIds.has(f.id);
                      return (
                        <CommandItem
                          key={`func-${f.id}`}
                          value={`func-${f.id}`}
                          onSelect={() => !isAdded && handleSelectFuncionario(f.id)}
                          className={cn(
                            "cursor-pointer py-2.5 px-3",
                            isAdded && "opacity-50 cursor-not-allowed"
                          )}
                          style={{ pointerEvents: 'auto' }}
                          disabled={isAdded}
                        >
                          {isAdded ? (
                            <Check className="mr-2 h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <User className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className={cn("block", isAdded && "line-through")}>{f.nome_completo}</span>
                            {f.bd_funcoes?.nome_funcao && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {f.bd_funcoes.nome_funcao}
                              </p>
                            )}
                          </div>
                          {isAdded && (
                            <span className="text-xs text-muted-foreground ml-2">Já adicionado</span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
