/**
 * CT-5 — Catálogo de caminhões da puxada (seleção de UM caminhão por vez).
 *
 * Reaproveita integralmente o motor de catálogo do CT-4
 * (fn_ct_ativos_movimentacao_listar, busca 100% server-side) e as mesmas
 * regras invioláveis:
 *   - nenhum ativo é escondido: bloqueado aparece, porém não-selecionável;
 *   - elegibilidade NUNCA é recalculada no cliente (`elegivel` é do servidor);
 *   - erro técnico da consulta não é apresentado como "nenhum caminhão".
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronsUpDown, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { podeSelecionarAtivoParada } from "@/lib/central-transporte/elegibilidadeSelecaoParada";
import { useCtAtivosMovimentacao } from "@/hooks/central-transporte/useCtMovDireta";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
} from "@/types/centralTransporteMovDireta";

const DISPONIBILIDADE: Record<string, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_REGISTRO: "Sem registro",
};

const situacaoDe = (a: CtAtivoMovimentacao): string | null => {
  if (!a.possuiRegistro) return "Disponibilidade operacional não cadastrada";
  if (a.compromissoViagem) return `Reservado na ${a.compromissoViagem}`;
  if (a.osManutencao) return `Em manutenção — OS ${a.osManutencao}`;
  return a.bloqueioMotivo;
};

interface Props {
  /** Caminhões já incluídos nesta puxada (não podem repetir). */
  jaEscolhidos: Set<string>;
  desabilitado: boolean;
  onSelecionar: (ativo: CtAtivoMovimentacao) => void;
}

const CatalogoCaminhaoPuxada: React.FC<Props> = ({
  jaEscolhidos,
  desabilitado,
  onSelecionar,
}) => {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermoAplicado(termo.trim()), 350);
    return () => clearTimeout(t);
  }, [termo]);

  /* A consulta só existe com o popover aberto. */
  const { ativos, isLoading, error } = useCtAtivosMovimentacao(termoAplicado || null, aberto);

  /**
   * Caminho ÚNICO de seleção (mouse e teclado): o guard evita alternância dupla
   * quando o clique dispara `onClick` e o `onSelect` interno do cmdk no mesmo
   * ciclo de evento (mesma solução validada no catálogo de paradas do CT-4).
   */
  const ultimoDisparo = React.useRef<{ id: string; t: number } | null>(null);
  const escolher = useCallback(
    (a: CtAtivoMovimentacao) => {
      const agora = Date.now();
      const anterior = ultimoDisparo.current;
      if (anterior && anterior.id === a.equipamentoId && agora - anterior.t < 120) return;
      ultimoDisparo.current = { id: a.equipamentoId, t: agora };
      onSelecionar(a);
      setAberto(false);
      setTermo("");
    },
    [onSelecionar],
  );

  const vazio = useMemo(
    () =>
      termoAplicado
        ? `Nenhum caminhão/equipamento encontrado para “${termoAplicado}”.`
        : "Nenhum ativo cadastrado no seu escopo de acesso.",
    [termoAplicado],
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={desabilitado}
          className="h-9 w-full justify-between text-xs font-normal"
          data-testid="ct5-catalogo-caminhao-trigger"
        >
          <span className="flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar caminhão
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,90vw)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={termo}
            onValueChange={setTermo}
            placeholder="Buscar por frota, número, placa ou modelo..."
            data-testid="ct5-catalogo-caminhao-busca"
          />
          <CommandList className="max-h-[52vh]" style={{ pointerEvents: "auto" }}>
            {error ? (
              <div
                className="flex gap-2 p-3 text-[11px] text-destructive"
                data-testid="ct5-catalogo-caminhao-erro"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-snug">
                  Não foi possível consultar o catálogo de ativos. Isto é um erro técnico da
                  consulta (não significa “nenhum caminhão”). Tente novamente; se persistir,
                  avise o suporte.
                </p>
              </div>
            ) : isLoading ? (
              <div className="space-y-1.5 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : ativos.length === 0 ? (
              <p
                className="p-4 text-center text-[11px] text-muted-foreground"
                data-testid="ct5-catalogo-caminhao-vazio"
              >
                {vazio}
              </p>
            ) : (
              <CommandGroup>
                {ativos.map((a) => {
                  const repetido = jaEscolhidos.has(a.equipamentoId);
                  const selecionavel = podeSelecionarAtivoParada({
                    elegivel: a.elegivel,
                    jaNestaParada: false,
                    usadoEmOutraParada: repetido,
                  });
                  const situacao = repetido ? "Já incluído nesta puxada" : situacaoDe(a);
                  return (
                    <CommandItem
                      key={a.equipamentoId}
                      value={a.equipamentoId}
                      data-testid={`ct5-catalogo-caminhao-item-${a.equipamentoId}`}
                      className={cn(
                        "items-start gap-2 select-none",
                        selecionavel
                          ? "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                          : "cursor-not-allowed opacity-60",
                      )}
                      style={{ pointerEvents: "auto" }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selecionavel) return;
                        escolher(a);
                      }}
                      onSelect={() => {
                        if (!selecionavel) return;
                        escolher(a);
                      }}
                    >
                      <div className="pointer-events-none min-w-0 flex-1 leading-tight">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium">
                            {rotuloAtivoMovimentacao(a)}
                          </p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {DISPONIBILIDADE[a.statusOperacional] ?? a.statusOperacional}
                          </Badge>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[a.placa, a.modelo, a.centroCustoLabel].filter(Boolean).join(" · ") ||
                            "Sem detalhes de cadastro"}
                        </p>
                        {situacao && (
                          <p
                            className={cn(
                              "truncate text-[11px]",
                              selecionavel ? "text-amber-600" : "text-destructive",
                            )}
                          >
                            {situacao}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CatalogoCaminhaoPuxada;
