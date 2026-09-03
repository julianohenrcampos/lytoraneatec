import React, { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { UserPlus, Loader2 } from "lucide-react";
import { useFuncionariosBuscaAtivos } from "@/hooks/diarias/useFuncionariosBuscaAtivos";

interface AdicionarFuncionarioPopoverProps {
  jaAdicionadosIds: string[];
  onAdicionar: (func: {
    id: string;
    nome_completo: string;
    funcao_nome?: string | null;
  }) => void;
  disabled?: boolean;
}

/**
 * Fase 3 — busca sob demanda via RPC get_funcionarios_ativos_global.
 * Não altera bd_equipes.equipe nem bd_funcionarios.equipe_id.
 * Apenas devolve o funcionário selecionado ao formulário local.
 */
const AdicionarFuncionarioPopover: React.FC<AdicionarFuncionarioPopoverProps> = ({
  jaAdicionadosIds,
  onAdicionar,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { funcionarios, isFetching } = useFuncionariosBuscaAtivos({
    search,
    limit: 30,
    enabled: open,
  });

  const jaAdicionadosSet = useMemo(() => new Set(jaAdicionadosIds), [jaAdicionadosIds]);

  const disponiveis = useMemo(
    () => funcionarios.filter((f) => !jaAdicionadosSet.has(f.id)),
    [funcionarios, jaAdicionadosSet]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <UserPlus className="h-4 w-4 mr-1" />
          Adicionar funcionário
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome, CPF ou matrícula..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Buscando...
              </div>
            )}
            {!isFetching && disponiveis.length === 0 && (
              <CommandEmpty>
                {search.trim() === ""
                  ? "Digite para buscar funcionários ativos."
                  : "Nenhum funcionário encontrado."}
              </CommandEmpty>
            )}
            {!isFetching && disponiveis.length > 0 && (
              <CommandGroup>
                {disponiveis.map((f) => (
                  <CommandItem
                    key={f.id}
                    value={f.id}
                    onSelect={() => {
                      onAdicionar({
                        id: f.id,
                        nome_completo: f.nome_completo,
                        funcao_nome: f.bd_funcoes?.nome_funcao ?? null,
                      });
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{f.nome_completo}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.bd_funcoes?.nome_funcao ?? "—"}
                        {f.matricula ? ` · Mat. ${f.matricula}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AdicionarFuncionarioPopover;
