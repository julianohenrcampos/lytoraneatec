/**
 * CT-3B.2 — Seletor do item da solicitação (dois modos).
 *
 * Modo "vazio": apenas o combobox e a orientação, sem nenhum contador.
 * Modo "selecionado": barra compacta única com Solicitado / Reservado /
 * Pendente e a navegação Anterior / Selecionar item / Próximo.
 *
 * Nenhum contador é calculado aqui — todos vêm de fn_ct_atendimento_listar.
 */
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronLeft, ChevronRight, List } from "lucide-react";
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtContadores } from "@/types/centralTransporteCT2";
import { descricaoItem } from "./itemDisplay";
import {
  PLACEHOLDER_SELETOR_ITEM,
  resumoCompactoItem,
  rotuloOpcaoItem,
} from "@/utils/central-transporte/selecaoProgressiva";

interface Props {
  itens: SolicitacaoItem[];
  itemSelecionadoId: string | null;
  onSelecionarItem: (itemId: string) => void;
  contadoresDoItem: (itemId: string | null) => CtContadores | null;
  onVerTodosItens: () => void;
}

export const ItemSelectorBar: React.FC<Props> = ({
  itens,
  itemSelecionadoId,
  onSelecionarItem,
  contadoresDoItem,
  onVerTodosItens,
}) => {
  const [aberto, setAberto] = useState(false);

  const indice = useMemo(
    () => itens.findIndex((i) => i.id === itemSelecionadoId),
    [itens, itemSelecionadoId],
  );
  const item = indice >= 0 ? itens[indice] : null;
  const resumo = resumoCompactoItem(item, contadoresDoItem(itemSelecionadoId));

  const ir = (delta: number) => {
    const proximo = itens[indice + delta];
    if (proximo) onSelecionarItem(proximo.id);
  };

  const seletor = (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          data-testid="ct3b1-item-seletor"
          className="min-w-0 flex-1 justify-between gap-2"
        >
          <span className="min-w-0 truncate text-left text-xs font-medium">
            {item ? descricaoItem(item) : PLACEHOLDER_SELETOR_ITEM}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar item da solicitação..." className="text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum item corresponde à busca.</CommandEmpty>
            <CommandGroup>
              {itens.map((it) => {
                const rotulo = rotuloOpcaoItem(it, contadoresDoItem(it.id));
                return (
                  <CommandItem
                    key={it.id}
                    value={`${rotulo.descricao} ${it.id}`}
                    data-testid={`ct3b1-item-opcao-${it.id}`}
                    onSelect={() => {
                      onSelecionarItem(it.id);
                      setAberto(false);
                    }}
                    className="items-start gap-2 text-xs"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        it.id === itemSelecionadoId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{rotulo.descricao}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {rotulo.situacao}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (!item) {
    return (
      <Card data-testid="ct3b2-item-selector-vazio">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Item da solicitação
          </span>
          <div className="flex min-w-[220px] flex-1 items-center">{seletor}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="ct3b1-item-selector-bar">
      <CardContent className="flex flex-wrap items-center gap-2 p-3">
        <Button
          size="icon"
          variant="outline"
          aria-label="Item anterior"
          data-testid="ct3b1-item-anterior"
          disabled={indice <= 0}
          onClick={() => ir(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {seletor}

        <Button
          size="icon"
          variant="outline"
          aria-label="Próximo item"
          data-testid="ct3b1-item-proximo"
          disabled={indice < 0 || indice >= itens.length - 1}
          onClick={() => ir(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* CT-3B.2 — resumo compacto: apenas Solicitado / Reservado / Pendente. */}
        <div className="flex items-center gap-1.5" data-testid="ct3b2-item-resumo">
          <Badge variant="outline" className="text-[10px]">
            Solicitado {resumo?.solicitado ?? "—"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Reservado {resumo?.reservado ?? "—"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Pendente {resumo?.pendente ?? "—"}
          </Badge>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="gap-1"
          data-testid="ct3b1-ver-todos-itens"
          onClick={onVerTodosItens}
        >
          <List className="h-3.5 w-3.5" /> Ver todos os itens
        </Button>
      </CardContent>
    </Card>
  );
};

export default ItemSelectorBar;
