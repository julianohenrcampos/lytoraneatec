"use client"

import * as React from "react"
import { Check, Search, Users, User, AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { FuncionarioPreConvocado } from "@/types/diarias"
import type { EstadoElegibilidade } from "@/hooks/diarias/useFuncionarioElegibilidade"

interface FuncionarioItem {
  id: string;
  nome_completo: string;
  funcao_id: string;
  centro_custo_id?: string | null;
  matricula?: string | null;
  status_funcionario?: string | null;
  elegivel?: boolean;
  motivo_bloqueio?: string | null;
  fora_centro_custo_solicitacao?: boolean;
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

export interface ConflitoSelecao {
  funcionarioId: string;
  alocacao?: { numero_solicitacao: string; codigo_centro_custo: string };
  motivo?: string;
}

interface SmartFuncionarioSearchProps {
  funcionarios: FuncionarioItem[];
  centrosCusto: CentroCustoItem[];
  convocadosPre: FuncionarioPreConvocado[];
  onSelectFuncionario: (id: string) => void;
  onSelectCentroCusto: (id: string) => void;
  disabled?: boolean;
  alocacoesPorFuncionario?: Map<string, { numero_solicitacao: string; codigo_centro_custo: string }>;
  /**
   * Quando definido, funcionários com conflito operacional (alocação em outra
   * solicitação ou status='alerta'/elegivel=false sem ser bloqueio de status RH)
   * deixam de ser disabled e passam a disparar este callback em vez de
   * onSelectFuncionario. O pai deve abrir uma confirmação e, se aceita,
   * chamar o handler de adição com bypass de conflito.
   */
  onSelectFuncionarioComConflito?: (conflito: ConflitoSelecao) => void;
  /** Modo controlado: input alimentado pelo pai (busca server-side). */
  searchValue?: string;
  /** Callback de change quando em modo controlado. */
  onSearchChange?: (value: string) => void;
  /** Indicador visual de busca em andamento. */
  isSearching?: boolean;
  /**
   * Mapa de elegibilidade vindo do useFuncionarioElegibilidade.
   * Quando presente, sobrescreve `elegivel` / `motivo_bloqueio` por id
   * com a regra dos 3 estados (livre / alerta / bloqueado).
   */
  elegibilidadeMap?: Map<string, EstadoElegibilidade>;
}

// Status de RH considerados bloqueio real de seleção (não-conflito).
const STATUS_RH_PERMITIDOS = new Set(["Ativo", "Ativo sem Registro"]);

export function SmartFuncionarioSearch({
  funcionarios,
  centrosCusto,
  convocadosPre,
  onSelectFuncionario,
  onSelectCentroCusto,
  disabled = false,
  alocacoesPorFuncionario = new Map(),
  onSelectFuncionarioComConflito,
  searchValue,
  onSearchChange,
  isSearching = false,
  elegibilidadeMap,
}: SmartFuncionarioSearchProps) {
  const isControlled = typeof onSearchChange === "function";
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState("")
  const inputValue = isControlled ? (searchValue ?? "") : internalValue;

  const normalizeSearch = React.useCallback((value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  }, [])

  const searchTerm = React.useMemo(() => normalizeSearch(inputValue), [inputValue, normalizeSearch])

  const addedIds = React.useMemo(() => 
    new Set(convocadosPre.map(c => c.funcionario_id)), 
    [convocadosPre]
  );

  const funcionariosOperacionais = React.useMemo(() => funcionarios, [funcionarios])

  const totalFuncionariosPorCentro = React.useMemo(() => {
    const counts = new Map<string, number>()

    for (const funcionario of funcionariosOperacionais) {
      if (!funcionario.centro_custo_id) continue
      counts.set(funcionario.centro_custo_id, (counts.get(funcionario.centro_custo_id) ?? 0) + 1)
    }

    return counts
  }, [funcionariosOperacionais])

  const filteredCentros = React.useMemo(() => {
    if (!searchTerm) return [];
    return centrosCusto.filter(cc =>
      normalizeSearch(cc.nome_centro_custo).includes(searchTerm) ||
      normalizeSearch(cc.codigo_centro_custo).includes(searchTerm)
    ).slice(0, 5);
  }, [centrosCusto, normalizeSearch, searchTerm]);

  const filteredFuncionarios = React.useMemo(() => {
    // Em modo controlado a lista já vem filtrada do servidor; não trunca.
    if (isControlled) return funcionariosOperacionais;
    if (!searchTerm) {
      return funcionariosOperacionais.slice(0, 20);
    }

    return funcionariosOperacionais.filter((f) => {
      const nome = normalizeSearch(f.nome_completo)
      const matricula = normalizeSearch(f.matricula || "")
      const funcao = normalizeSearch(f.bd_funcoes?.nome_funcao || "")

      return nome.includes(searchTerm) || matricula.includes(searchTerm) || funcao.includes(searchTerm)
    }).slice(0, 10);
  }, [funcionariosOperacionais, normalizeSearch, searchTerm, isControlled]);

  const setValue = React.useCallback((value: string) => {
    if (isControlled) {
      onSearchChange?.(value);
    } else {
      setInternalValue(value);
    }
  }, [isControlled, onSearchChange]);

  const handleSelectFuncionario = React.useCallback((funcId: string) => {
    onSelectFuncionario(funcId);
    setValue("");
    setOpen(false);
  }, [onSelectFuncionario, setValue]);

  const handleSelectCentroCusto = React.useCallback((ccId: string) => {
    onSelectCentroCusto(ccId);
    setValue("");
    setOpen(false);
  }, [onSelectCentroCusto, setValue]);

  const hasResults = filteredCentros.length > 0 || filteredFuncionarios.length > 0;
  const showingInitialList = !searchTerm;

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
              onChange={(e) => setValue(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
          <CommandList className="max-h-[350px] overflow-y-auto" style={{ pointerEvents: 'auto' }}>
            {!hasResults ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {showingInitialList ? 'Nenhum funcionário disponível para o período selecionado' : 'Nenhum resultado encontrado'}
              </div>
            ) : (
              <>
                {filteredCentros.length > 0 && (
                  <CommandGroup heading="Centros de Custo">
                    {filteredCentros.map((cc) => {
                      const countInCc = totalFuncionariosPorCentro.get(cc.id) ?? 0;
                      return (
                        <CommandItem
                          key={`cc-${cc.id}`}
                          value={`${cc.codigo_centro_custo} ${cc.nome_centro_custo}`}
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
                      const temMatricula = !!f.matricula;
                      const alocacao = alocacoesPorFuncionario.get(f.id);
                      const statusRaw = f.status_funcionario || "";
                      const isStatusBloqueado = statusRaw.length > 0 && !STATUS_RH_PERMITIDOS.has(statusRaw);

                      // Estado de elegibilidade vindo da RPC fn_diaria_funcionario_elegibilidade.
                      // Quando presente, sobrescreve elegivel/motivo_bloqueio do registro.
                      const elegState = elegibilidadeMap?.get(f.id);
                      const isBloqueadoElegibilidade = elegState?.status === "bloqueado";
                      const isAlertaElegibilidade = elegState?.status === "alerta";
                      const motivoEffective = elegState?.motivo ?? f.motivo_bloqueio ?? null;

                      // Conflito operacional = alocado em outra solicitação OU
                      // status='alerta' OU (legacy) elegivel=false sem ser bloqueio de status RH.
                      const hasConflito =
                        !!alocacao ||
                        isAlertaElegibilidade ||
                        (elegState === undefined && f.elegivel === false && !isStatusBloqueado);

                      // Bloqueio duro: status RH inválido OU elegibilidade='bloqueado'.
                      const isHardBlocked = isStatusBloqueado || isBloqueadoElegibilidade;

                      const podeSelecionarComConfirmacao =
                        hasConflito && !!onSelectFuncionarioComConflito && !isHardBlocked;
                      const canSelect = !isAdded && !isHardBlocked && (!hasConflito || podeSelecionarComConfirmacao);

                      const handleClick = () => {
                        if (!canSelect) return;
                        if (hasConflito && onSelectFuncionarioComConflito) {
                          onSelectFuncionarioComConflito({
                            funcionarioId: f.id,
                            alocacao: alocacao
                              ? { numero_solicitacao: alocacao.numero_solicitacao, codigo_centro_custo: alocacao.codigo_centro_custo }
                              : undefined,
                            motivo: motivoEffective || elegState?.alertaMensagem || undefined,
                          });
                          setValue("");
                          setOpen(false);
                          return;
                        }
                        handleSelectFuncionario(f.id);
                      };

                      return (
                        <CommandItem
                          key={`func-${f.id}`}
                          value={`${f.nome_completo} ${f.bd_funcoes?.nome_funcao || ''} ${f.matricula || ''}`}
                          onSelect={handleClick}
                          className={cn(
                            "cursor-pointer py-2.5 px-3",
                            isAdded && "opacity-50 cursor-not-allowed",
                            isHardBlocked && !isAdded && "opacity-60 cursor-not-allowed",
                            hasConflito && !isAdded && !isHardBlocked && "border-l-2 border-l-destructive",
                            f.fora_centro_custo_solicitacao && !hasConflito && !isHardBlocked && "border-l-2 border-l-primary/60"
                          )}
                          style={{ pointerEvents: 'auto' }}
                          disabled={isAdded || isHardBlocked}
                          title={
                            isHardBlocked
                              ? `Indisponível: ${motivoEffective || statusRaw || 'bloqueado'}`
                              : hasConflito
                                ? (alocacao
                                    ? `Já vinculado à solicitação ${alocacao.numero_solicitacao} (CC ${alocacao.codigo_centro_custo}). Clique para confirmar.`
                                    : (motivoEffective || elegState?.alertaMensagem || "Conflito operacional. Clique para confirmar."))
                                : undefined
                          }
                        >
                          {isAdded ? (
                            <Check className="mr-2 h-4 w-4 shrink-0 text-primary" />
                          ) : isHardBlocked ? (
                            <AlertTriangle className="mr-2 h-4 w-4 shrink-0 text-amber-600" />
                          ) : hasConflito ? (
                            <AlertTriangle className="mr-2 h-4 w-4 shrink-0 text-destructive" />
                          ) : (
                            <User className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("block", isAdded && "line-through")}>{f.nome_completo}</span>
                              {temMatricula && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-700 shrink-0">
                                  Remessa
                                </Badge>
                              )}
                              {isStatusBloqueado && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-foreground/40 text-muted-foreground shrink-0">
                                  {statusRaw}
                                </Badge>
                              )}
                            </div>
                            {f.bd_funcoes?.nome_funcao && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {f.bd_funcoes.nome_funcao}
                              </p>
                            )}
                            {f.fora_centro_custo_solicitacao && (
                              <p className="text-xs text-primary mt-0.5">
                                Fora do centro de custo da solicitação
                              </p>
                            )}
                            {alocacao && !isAdded && (
                              <p className="text-xs text-destructive mt-0.5">
                                Convocado no CC: {alocacao.codigo_centro_custo} — Solicitação: {alocacao.numero_solicitacao}
                              </p>
                            )}
                            {!alocacao && motivoEffective && (
                              <p className={cn("text-xs mt-0.5", isHardBlocked ? "text-muted-foreground" : "text-destructive")}>
                                {motivoEffective}
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
