/**
 * CT-4 — Catálogo de ativos DENTRO da parada de entrega.
 *
 * Este é o único lugar onde o catálogo de Caminhões e Equipamentos é consultado
 * (RPC fn_ct_ativos_movimentacao_listar, busca 100% server-side com termo
 * normalizado). Regras invioláveis respeitadas aqui:
 *   - nenhum ativo é escondido: bloqueado aparece, porém não-selecionável;
 *   - elegibilidade NUNCA é recalculada no cliente (`elegivel` vem do servidor);
 *   - erro técnico da consulta não é apresentado como "nenhum ativo".
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronsUpDown, X } from "lucide-react";
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

/** Rótulos amigáveis dos status reais de bd_disponibilidade_equipamentos. */
const DISPONIBILIDADE: Record<string, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_REGISTRO: "Sem registro",
};

const rotuloStatus = (a: CtAtivoMovimentacao): string =>
  DISPONIBILIDADE[a.statusOperacional] ?? a.statusOperacional;

/** Situação exibida ao operador (precedência definida pela operação). */
const situacaoDe = (a: CtAtivoMovimentacao): string | null => {
  if (!a.possuiRegistro) return "Disponibilidade operacional não cadastrada";
  if (a.compromissoViagem) return `Reservado na ${a.compromissoViagem}`;
  if (a.osManutencao) return `Em manutenção — OS ${a.osManutencao}`;
  return a.bloqueioMotivo;
};

interface Props {
  ordem: number;
  /** Ativos já selecionados NESTA parada. */
  selecionados: string[];
  /** Ativos usados em OUTRAS paradas da mesma viagem. */
  alocadosEmOutrasParadas: Map<string, { indice: number; rotulo: string }>;
  /** Metadados já conhecidos (rascunho persistido) para rotular os chips. */
  metadados: Map<string, CtAtivoMovimentacao>;
  desabilitado: boolean;
  onChange: (equipamentos: string[]) => void;
  /** Propaga ao pai os dados de catálogo dos ativos escolhidos. */
  onConhecerAtivo?: (ativo: CtAtivoMovimentacao) => void;
}

const CatalogoAtivosParada: React.FC<Props> = ({
  ordem,
  selecionados,
  alocadosEmOutrasParadas,
  metadados,
  desabilitado,
  onChange,
  onConhecerAtivo,
}) => {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermoAplicado(termo.trim()), 350);
    return () => clearTimeout(t);
  }, [termo]);

  /* A consulta só existe com o popover aberto. */
  const { ativos, isLoading, isFetching, error } = useCtAtivosMovimentacao(
    termoAplicado || null,
    aberto,
  );

  const [cache, setCache] = useState<Record<string, CtAtivoMovimentacao>>({});
  useEffect(() => {
    if (ativos.length === 0) return;
    setCache((prev) => {
      const next = { ...prev };
      ativos.forEach((a) => {
        next[a.equipamentoId] = a;
      });
      return next;
    });
  }, [ativos]);

  const rotuloDe = (id: string): string => {
    const a = cache[id] ?? metadados.get(id) ?? null;
    return a ? rotuloAtivoMovimentacao(a) : id.slice(0, 8);
  };

  const selecionadosSet = useMemo(() => new Set(selecionados), [selecionados]);

  /**
   * Caminho ÚNICO e autoritativo de seleção (mouse e teclado passam por aqui).
   * O guard evita alternância dupla quando o clique dispara `onClick` e, no mesmo
   * ciclo de evento, o `onSelect` interno do cmdk.
   */
  const ultimoDisparo = React.useRef<{ id: string; t: number } | null>(null);
  const alternar = useCallback((a: CtAtivoMovimentacao) => {
    const agora = Date.now();
    const anterior = ultimoDisparo.current;
    if (anterior && anterior.id === a.equipamentoId && agora - anterior.t < 120) return;
    ultimoDisparo.current = { id: a.equipamentoId, t: agora };

    if (selecionadosSet.has(a.equipamentoId)) {
      onChange(selecionados.filter((x) => x !== a.equipamentoId));
      return;
    }
    onConhecerAtivo?.(a);
    onChange([...selecionados, a.equipamentoId]);
  }, [onChange, onConhecerAtivo, selecionados, selecionadosSet]);


  return (
    <div className="space-y-2" data-testid={`ct4-catalogo-parada-${ordem}`}>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={desabilitado}
            className="h-9 w-full justify-between text-xs font-normal"
            data-testid={`ct4-catalogo-trigger-${ordem}`}
          >
            {selecionados.length === 0
              ? "Selecione os ativos..."
              : `${selecionados.length} ativo(s) selecionado(s)`}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(560px,90vw)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={termo}
              onValueChange={setTermo}
              placeholder="Buscar por frota, número, placa ou modelo..."
              data-testid={`ct4-catalogo-busca-${ordem}`}
            />
            <CommandList className="max-h-[52vh]" style={{ pointerEvents: "auto" }}>
              {error ? (
                <div
                  className="flex gap-2 p-3 text-[11px] text-destructive"
                  data-testid={`ct4-catalogo-erro-${ordem}`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="leading-snug">
                    Não foi possível consultar o catálogo de ativos. Isto é um erro técnico da
                    consulta (não significa “nenhum ativo”). Tente novamente; se persistir, avise
                    o suporte.
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
                  data-testid={`ct4-catalogo-vazio-${ordem}`}
                >
                  {termoAplicado
                    ? `Nenhum ativo encontrado para “${termoAplicado}”.`
                    : "Nenhum ativo cadastrado no seu escopo de acesso."}
                </p>
              ) : (
                <CommandGroup>
                  {ativos.map((a) => {
                    const jaNestaParada = selecionadosSet.has(a.equipamentoId);
                    const outraParada = alocadosEmOutrasParadas.get(a.equipamentoId) ?? null;
                    const selecionavel = podeSelecionarAtivoParada({
                      elegivel: a.elegivel,
                      jaNestaParada,
                      usadoEmOutraParada: Boolean(outraParada),
                    });
                    const situacao = outraParada
                      ? `Já nesta viagem — ${outraParada.rotulo}`
                      : situacaoDe(a);
                    const motivoBloqueio = selecionavel
                      ? null
                      : situacao ?? "Bloqueado para planejamento";
                    return (
                      <CommandItem
                        key={a.equipamentoId}
                        value={a.equipamentoId}
                        disabled={!selecionavel}
                        data-testid={`ct4-catalogo-item-${a.equipamentoId}`}
                        className={cn(
                          "items-start gap-2 select-none",
                          selecionavel
                            ? "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                            : "cursor-not-allowed opacity-50",
                        )}
                        style={{ pointerEvents: "auto" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!selecionavel) return;
                          alternar(a);
                        }}
                        onSelect={() => {
                          if (!selecionavel) return;
                          alternar(a);
                        }}
                      >
                        <Check
                          className={cn(
                            "pointer-events-none mt-0.5 h-3.5 w-3.5 shrink-0",
                            jaNestaParada ? "opacity-100" : "opacity-0",
                          )}
                          aria-hidden="true"
                        />

                        <div className="pointer-events-none min-w-0 flex-1 leading-tight">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-medium">
                              {rotuloAtivoMovimentacao(a)}
                            </p>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {rotuloStatus(a)}
                            </Badge>
                          </div>
                          {(a.tipoAtivo || a.modelo) && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {[a.tipoAtivo, a.modelo].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          <p className="truncate text-[11px] text-muted-foreground">
                            Placa: {a.placa ?? "—"} · CC: {a.centroCustoLabel ?? "—"}
                          </p>
                          {(motivoBloqueio || situacao) && (
                            <p
                              className={cn(
                                "truncate text-[11px]",
                                motivoBloqueio ? "font-medium text-destructive" : "text-muted-foreground",
                              )}
                              title={motivoBloqueio ?? situacao ?? undefined}
                            >
                              {motivoBloqueio ? `Bloqueado: ${motivoBloqueio}` : situacao}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {isFetching && !isLoading && !error && (
                <p className="px-3 pb-2 text-[11px] text-muted-foreground">Buscando ativos...</p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selecionados.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px]"
              data-testid={`ct4-chip-ativo-${id}`}
            >
              {rotuloDe(id)}
              {!desabilitado && (
                <button
                  type="button"
                  aria-label="Remover ativo da parada"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(selecionados.filter((x) => x !== id))}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        Busque no catálogo de Caminhões e Equipamentos. Ativos indisponíveis ou já comprometidos
        aparecem, porém não podem ser selecionados.
      </p>
    </div>
  );
};

export default CatalogoAtivosParada;
