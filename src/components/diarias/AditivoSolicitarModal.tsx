// =====================================================
// MODAL: Solicitação de Aditivo de Diária — Fase I.3 (UX único)
// =====================================================
// Único modal visual: chips de dias + matriz funcionário×dia.
// O usuário ajusta o planejamento. O modal calcula o diff
// vs. convocados_pre atuais e dispara as RPCs corretas:
//   - adicionar_dia / remover_dia (solicitar_aditivo_dia)
//   - solicitar_aditivo_funcionario (para funcionário NOVO)
//
// Nada é escrito em convocados_pre, bd_diaria_presencas
// ou bd_diaria_apontamentos antes da aprovação.
// =====================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Search,
  Trash2,
  Users,
  CalendarPlus,
  AlertTriangle,
  Building2,
  User,
  Hash,
  CheckCircle2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { usePermission } from "@/hooks/usePermission";
import {
  useSolicitarAditivoDia,
  useSolicitarAditivoFuncionario,
} from "@/hooks/diarias/useAditivos";
import type {
  AditivoDiaFuncionarioItem,
  SnapshotFuncionario,
} from "@/services/diarias/aditivoService";
import {
  lerConvocadosPre,
  derivarFuncionariosPlanos,
} from "@/lib/diarias/convocadosPreAdapter";
import type { DiariaSolicitacao, FuncionarioPreConvocado } from "@/types/diarias";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { EstimativaAviso } from "./EstimativaAviso";
import { useFeriadosPeriodo } from "@/hooks/diarias/useFeriados";
import { analisarPeriodo } from "@/utils/diariasPeriodoUtils";
import { calcularEstimativaPorConvocadosPre } from "@/utils/diariasEstimativaPorConvocadosPre";

interface AditivoSolicitarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitacao: DiariaSolicitacao;
}

// ---------- helpers ----------

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

/** Hoje em UTC-3 (YYYY-MM-DD). */
function hojeBR(): string {
  const now = new Date();
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

/** Lista YYYY-MM-DD entre inicio..fim (inclusivos). */
function listarDiasPeriodo(inicio: string, fim: string): string[] {
  const out: string[] = [];
  const [y, m, d] = inicio.split("-").map(Number);
  const [y2, m2, d2] = fim.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  for (let cur = start; cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

const fmtDM = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const fmtDow = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getUTCDay()];
};

interface FuncLinha {
  funcionario_id: string;
  nome_funcionario: string;
  matricula?: string | null;
  funcao_id: string | null;
  nome_funcao?: string | null;
  valor_diaria: number;
  valor_diaria_exclusiva: number | null;
  valor_refeicao: number;
  /** true = já estava em convocados_pre; false = adicionado via busca */
  existente: boolean;
}

// =====================================================
// Componente
// =====================================================
export function AditivoSolicitarModal({
  open,
  onOpenChange,
  solicitacao,
}: AditivoSolicitarModalProps) {
  const solicitarDia = useSolicitarAditivoDia();
  const solicitarFunc = useSolicitarAditivoFuncionario();

  // RBAC: liberação retroativa segue a mesma regra do backend (RPC).
  // permiteRetroativo = SuperAdm/acesso_global OU diarias_aditivo_retroativo:criar.
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const permiteRetroativo =
    isSuperAdmin || hasActionPermission("diarias_aditivo_retroativo", "criar");

  const hoje = useMemo(() => hojeBR(), []);
  const dias = useMemo(
    () => listarDiasPeriodo(solicitacao.data_inicio, solicitacao.data_fim),
    [solicitacao.data_inicio, solicitacao.data_fim],
  );

  // ---- estado atual aprovado (snapshot inicial) ----
  const convocadosAtuais: FuncionarioPreConvocado[] = useMemo(() => {
    return derivarFuncionariosPlanos(
      lerConvocadosPre(solicitacao.convocados_pre, {
        inicio: solicitacao.data_inicio,
        fim: solicitacao.data_fim,
      }),
    ).map(({ extras, ...rest }) => ({
      ...(extras ?? {}),
      ...rest,
    })) as unknown as FuncionarioPreConvocado[];
  }, [solicitacao]);

  /** Map<funcId, Set<dia>> — estado atual. */
  const atualPorFunc = useMemo(() => {
    const m = new Map<string, Set<string>>();
    convocadosAtuais.forEach((c) => {
      m.set(c.funcionario_id, new Set(c.dias_solicitados ?? []));
    });
    return m;
  }, [convocadosAtuais]);

  // ---- estado controlado (proposto) ----
  /** Linhas (existentes + novos). */
  const [linhas, setLinhas] = useState<FuncLinha[]>([]);
  /** Map<funcId, Set<dia>> — estado proposto. */
  const [proposto, setProposto] = useState<Map<string, Set<string>>>(new Map());
  const [justificativa, setJustificativa] = useState("");
  const [filtro, setFiltro] = useState("");
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);
  const [buscaFunc, setBuscaFunc] = useState("");

  // Reset ao abrir
  useEffect(() => {
    if (!open) return;
    setLinhas(
      convocadosAtuais.map<FuncLinha>((c) => ({
        funcionario_id: c.funcionario_id,
        nome_funcionario: c.nome_funcionario ?? c.funcionario_id,
        matricula: c.matricula ?? null,
        funcao_id: c.funcao_id ?? null,
        nome_funcao: c.nome_funcao ?? null,
        valor_diaria: Number(c.valor_diaria) || 0,
        valor_diaria_exclusiva:
          c.valor_diaria_exclusiva != null
            ? Number(c.valor_diaria_exclusiva)
            : null,
        valor_refeicao: Number(c.valor_refeicao) || 0,
        existente: true,
      })),
    );
    const m = new Map<string, Set<string>>();
    convocadosAtuais.forEach((c) =>
      m.set(c.funcionario_id, new Set(c.dias_solicitados ?? [])),
    );
    setProposto(m);
    setJustificativa("");
    setFiltro("");
    setBuscaFunc("");
    setDiaAtivo(null);
  }, [open, convocadosAtuais]);

  // ---- presenças reais (bloqueio de remoção) ----
  const presencasQ = useQuery({
    queryKey: ["aditivo-presencas-reais-modal-unico", solicitacao.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_diaria_presencas")
        .select("funcionario_id, data")
        .eq("solicitacao_id", solicitacao.id)
        .not("hora_entrada", "is", null);
      if (error) throw error;
      return new Set(
        (data ?? []).map((r: any) => `${r.funcionario_id}|${r.data}`),
      );
    },
    enabled: open,
    staleTime: 15_000,
  });
  const presencasReais = presencasQ.data ?? new Set<string>();

  // ---- união de dias já planejados (estado atual) ----
  const diasPlanejadosAtual = useMemo(() => {
    const s = new Set<string>();
    convocadosAtuais.forEach((c) =>
      (c.dias_solicitados ?? []).forEach((d) => s.add(d)),
    );
    return s;
  }, [convocadosAtuais]);

  // ---- união de dias propostos ----
  const diasPlanejadosProposto = useMemo(() => {
    const s = new Set<string>();
    proposto.forEach((days) => days.forEach((d) => s.add(d)));
    return s;
  }, [proposto]);

  // ---- toggles ----
  const togglePar = (funcId: string, dia: string) => {
    // bloqueio: presença real impede remoção
    if (atualPorFunc.get(funcId)?.has(dia) && presencasReais.has(`${funcId}|${dia}`)) {
      return;
    }
    // bloqueio: dia passado não pode ser alterado nesta fase
    if (dia < hoje && !permiteRetroativo) return;
    setProposto((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(funcId) ?? []);
      if (cur.has(dia)) cur.delete(dia);
      else cur.add(dia);
      next.set(funcId, cur);
      return next;
    });
  };

  /** Chip de dia: toggle global (todos os funcionários daquele dia). */
  const toggleDiaGlobal = (dia: string) => {
    if (dia < hoje && !permiteRetroativo) return;
    setProposto((prev) => {
      const next = new Map(prev);
      const algumMarcado = Array.from(next.values()).some((s) => s.has(dia));
      if (algumMarcado) {
        // desmarca todos (respeitando presença real)
        next.forEach((set, funcId) => {
          if (set.has(dia) && presencasReais.has(`${funcId}|${dia}`)) return;
          const novo = new Set(set);
          novo.delete(dia);
          next.set(funcId, novo);
        });
      } else {
        // marca para TODOS os funcionários da matriz
        linhas.forEach((l) => {
          const novo = new Set(next.get(l.funcionario_id) ?? []);
          novo.add(dia);
          next.set(l.funcionario_id, novo);
        });
      }
      return next;
    });
  };

  const removerLinha = (funcId: string) => {
    setLinhas((prev) => prev.filter((l) => l.funcionario_id !== funcId));
    setProposto((prev) => {
      const next = new Map(prev);
      next.delete(funcId);
      return next;
    });
  };

  // ---- busca de funcionários (server-side via RPC SECURITY DEFINER) ----
  // Usa get_funcionarios_ativos_global para evitar RLS de escopo em bd_funcionarios:
  // o aditivo é vinculado a uma solicitacao_id cujo CC já foi validado, então liberar
  // a busca global é seguro e consistente com o fluxo de Nova Solicitação.
  const buscaQ = useQuery({
    queryKey: [
      "aditivo-busca-func-rpc",
      buscaFunc.trim(),
      solicitacao.centro_custo_id ?? null,
    ],
    queryFn: async () => {
      const term = buscaFunc.trim();
      if (term.length < 2) return [] as any[];
      const { data, error } = await supabase.rpc(
        "get_funcionarios_ativos_global",
        {
          p_search: term,
          p_limit: 10,
          p_centro_custo: solicitacao.centro_custo_id ?? null,
        },
      );
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open && buscaFunc.trim().length >= 2,
    staleTime: 10_000,
  });

  const adicionarFuncionario = (row: any) => {
    if (linhas.some((l) => l.funcionario_id === row.id)) return;
    const nova: FuncLinha = {
      funcionario_id: row.id,
      nome_funcionario: row.nome_completo,
      matricula: row.matricula ?? null,
      funcao_id: row.funcao_id ?? null,
      nome_funcao: row.nome_funcao ?? null,
      valor_diaria: Number(row.valor_diaria) || 0,
      valor_diaria_exclusiva:
        row.valor_diaria_exclusiva != null
          ? Number(row.valor_diaria_exclusiva)
          : null,
      valor_refeicao: Number(row.valor_refeicao) || 0,
      existente: false,
    };
    setLinhas((prev) => [...prev, nova]);
    setProposto((prev) => {
      const next = new Map(prev);
      next.set(row.id, new Set());
      return next;
    });
    setBuscaFunc("");
  };

  // ---- diff ----
  const diff = useMemo(() => {
    /** dia → array de { funcionario_id, snapshot } */
    const adicionarPorData = new Map<
      string,
      Array<{ funcionario_id: string; snapshot: SnapshotFuncionario }>
    >();
    /** dia → array de { funcionario_id } */
    const removerPorData = new Map<string, Array<{ funcionario_id: string }>>();
    /** funcionário novo (não estava em convocados_pre) → pares (funcId, dia, snapshot) */
    const novoFuncPares: Array<{
      funcionario_id: string;
      dia: string;
      snapshot: SnapshotFuncionario;
    }> = [];

    const linhasById = new Map(linhas.map((l) => [l.funcionario_id, l]));

    // Para cada linha presente na proposta (existente ou nova)
    linhas.forEach((l) => {
      const propostoSet = proposto.get(l.funcionario_id) ?? new Set<string>();
      const atualSet = atualPorFunc.get(l.funcionario_id) ?? new Set<string>();

      if (!l.existente) {
        // Funcionário NOVO: cada dia proposto vira aditivo_funcionario
        propostoSet.forEach((dia) => {
          const snapshot: SnapshotFuncionario = {
            funcionario_id: l.funcionario_id,
            // Contrato canônico consumido por convocadosPreAdapter / UI / PDFs:
            nome_funcionario: l.nome_funcionario,
            nome_funcao: l.nome_funcao,
            // Aliases legados mantidos para compatibilidade com RPCs/consumidores antigos:
            nome: l.nome_funcionario,
            funcao_nome: l.nome_funcao,
            matricula: l.matricula,
            funcao_id: l.funcao_id,
            centro_custo_id: solicitacao.bd_centros_custo?.id ?? null,
            valor_diaria: l.valor_diaria,
            valor_diaria_exclusiva: l.valor_diaria_exclusiva,
            valor_refeicao: l.valor_refeicao,
          };

          novoFuncPares.push({
            funcionario_id: l.funcionario_id,
            dia,
            snapshot,
          });
        });
        return;
      }

      // Funcionário EXISTENTE: diff por par
      const adicionados: string[] = [];
      const removidos: string[] = [];
      propostoSet.forEach((d) => {
        if (!atualSet.has(d)) adicionados.push(d);
      });
      atualSet.forEach((d) => {
        if (!propostoSet.has(d)) removidos.push(d);
      });

      adicionados.forEach((dia) => {
        const snapshot: SnapshotFuncionario = {
          funcionario_id: l.funcionario_id,
          // Contrato canônico consumido por convocadosPreAdapter / UI / PDFs:
          nome_funcionario: l.nome_funcionario,
          nome_funcao: l.nome_funcao,
          // Aliases legados mantidos para compatibilidade com RPCs/consumidores antigos:
          nome: l.nome_funcionario,
          funcao_nome: l.nome_funcao,
          matricula: l.matricula,
          funcao_id: l.funcao_id,
          centro_custo_id: solicitacao.bd_centros_custo?.id ?? null,
          valor_diaria: l.valor_diaria,
          valor_diaria_exclusiva: l.valor_diaria_exclusiva,
          valor_refeicao: l.valor_refeicao,
        };

        const arr = adicionarPorData.get(dia) ?? [];
        arr.push({ funcionario_id: l.funcionario_id, snapshot });
        adicionarPorData.set(dia, arr);
      });
      removidos.forEach((dia) => {
        const arr = removerPorData.get(dia) ?? [];
        arr.push({ funcionario_id: l.funcionario_id });
        removerPorData.set(dia, arr);
      });
    });

    // Linhas removidas inteiras (existiam em atualPorFunc mas não em linhas)
    atualPorFunc.forEach((set, funcId) => {
      if (linhasById.has(funcId)) return;
      set.forEach((dia) => {
        const arr = removerPorData.get(dia) ?? [];
        arr.push({ funcionario_id: funcId });
        removerPorData.set(dia, arr);
      });
    });

    return { adicionarPorData, removerPorData, novoFuncPares };
  }, [linhas, proposto, atualPorFunc, solicitacao.bd_centros_custo?.id]);

  // ---- validações ----
  const remocoesBloqueadas = useMemo(() => {
    const bloq: Array<{ funcionario_id: string; dia: string }> = [];
    diff.removerPorData.forEach((arr, dia) => {
      arr.forEach((it) => {
        if (presencasReais.has(`${it.funcionario_id}|${dia}`)) {
          bloq.push({ funcionario_id: it.funcionario_id, dia });
        }
      });
    });
    return bloq;
  }, [diff.removerPorData, presencasReais]);

  const remocoesRetroativas = useMemo(() => {
    const out: Array<{ funcionario_id: string; dia: string }> = [];
    diff.removerPorData.forEach((arr, dia) => {
      if (dia < hoje) arr.forEach((it) => out.push({ ...it, dia }));
    });
    return out;
  }, [diff.removerPorData, hoje]);

  const adicoesRetroativas = useMemo(() => {
    const out: string[] = [];
    diff.adicionarPorData.forEach((_, dia) => {
      if (dia < hoje) out.push(dia);
    });
    diff.novoFuncPares.forEach((p) => {
      if (p.dia < hoje) out.push(p.dia);
    });
    return Array.from(new Set(out));
  }, [diff, hoje]);

  const totalMudancas =
    diff.adicionarPorData.size +
    diff.removerPorData.size +
    diff.novoFuncPares.length;

  // Há alguma operação retroativa proposta?
  const temOperacaoRetroativa =
    remocoesRetroativas.length > 0 || adicoesRetroativas.length > 0;
  // Mínimo de 20 caracteres quando há retroativo (alinhado ao RPC solicitar_aditivo_funcionario).
  const tamanhoMinJust = temOperacaoRetroativa ? 20 : 5;
  const justInvalida = justificativa.trim().length < tamanhoMinJust;
  const isMutating = solicitarDia.isPending || solicitarFunc.isPending;

  // Retroativo bloqueia confirmação apenas quando o usuário NÃO tem permissão.
  const retroBloqueia = !permiteRetroativo && temOperacaoRetroativa;

  const podeConfirmar =
    totalMudancas > 0 &&
    !justInvalida &&
    remocoesBloqueadas.length === 0 &&
    !retroBloqueia &&
    !isMutating;

  // ---- impacto financeiro (fonte única: Fase G) ----
  const { data: feriadosPeriodo = [] } = useFeriadosPeriodo(
    solicitacao.data_inicio,
    solicitacao.data_fim,
  );
  const analise = useMemo(() => {
    const feriadosFmt = feriadosPeriodo.map((f) => ({ data: f.data, nome: f.nome }));
    return analisarPeriodo(
      solicitacao.data_inicio,
      solicitacao.data_fim,
      feriadosFmt,
      solicitacao.considera_fds_feriado,
    );
  }, [
    solicitacao.data_inicio,
    solicitacao.data_fim,
    solicitacao.considera_fds_feriado,
    feriadosPeriodo,
  ]);

  const impacto = useMemo(() => {
    const datasClassificadas = analise?.datasClassificadas ?? [];

    // Snapshot "atual" (planejamento vigente).
    const atualEst = calcularEstimativaPorConvocadosPre({
      solicitacao,
      convocadosPre: convocadosAtuais,
      datasClassificadas,
    });

    // Snapshot "proposto" — só em memória.
    const convocadosPropostos = linhas.map((l) => {
      const atual = convocadosAtuais.find(
        (c) => c.funcionario_id === l.funcionario_id,
      );
      return {
        funcionario_id: l.funcionario_id,
        nome_funcionario: l.nome_funcionario,
        matricula: l.matricula ?? undefined,
        funcao_id: l.funcao_id ?? undefined,
        nome_funcao: l.nome_funcao ?? undefined,
        valor_diaria: l.valor_diaria,
        valor_diaria_exclusiva: l.valor_diaria_exclusiva,
        valor_refeicao: l.valor_refeicao,
        dias_solicitados: Array.from(proposto.get(l.funcionario_id) ?? []),
        usar_diaria_exclusiva:
          (atual as any)?.usar_diaria_exclusiva ?? false,
      } as unknown as FuncionarioPreConvocado;
    });

    const propostoEst = calcularEstimativaPorConvocadosPre({
      solicitacao,
      convocadosPre: convocadosPropostos,
      datasClassificadas,
    });

    return {
      atual: atualEst.total_geral,
      proposto: propostoEst.total_geral,
      diferenca: propostoEst.total_geral - atualEst.total_geral,
      delta_uteis:
        propostoEst.total_diarias_uteis - atualEst.total_diarias_uteis,
      delta_fds:
        propostoEst.total_diarias_fds_feriados -
        atualEst.total_diarias_fds_feriados,
      delta_refeicoes:
        propostoEst.total_refeicoes - atualEst.total_refeicoes,
    };
  }, [solicitacao, convocadosAtuais, linhas, proposto, analise]);

  // ---- linhas filtradas ----
  const linhasFiltradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter(
      (l) =>
        l.nome_funcionario.toLowerCase().includes(q) ||
        (l.nome_funcao ?? "").toLowerCase().includes(q) ||
        (l.matricula ?? "").toLowerCase().includes(q),
    );
  }, [linhas, filtro]);

  // ---- submit ----
  const handleConfirmar = async () => {
    if (!podeConfirmar) return;
    const j = justificativa.trim();
    const impactoGlobal = {
      valor_atual_aprovado: impacto.atual,
      valor_proposto: impacto.proposto,
      delta_total: impacto.diferenca,
      delta_uteis: impacto.delta_uteis,
      delta_fds: impacto.delta_fds,
      delta_refeicoes: impacto.delta_refeicoes,
    };
    try {
      // 1) Adicionar dia (por data) — sequencial
      for (const [dia, funcs] of diff.adicionarPorData) {
        const segDiaria = funcs.reduce(
          (s, f) => s + (f.snapshot.valor_diaria ?? 0),
          0,
        );
        const segRef = funcs.reduce(
          (s, f) => s + (f.snapshot.valor_refeicao ?? 0),
          0,
        );
        await solicitarDia.mutateAsync({
          solicitacaoId: solicitacao.id,
          dataAjustada: dia,
          acao: "adicionar_dia",
          funcionarios: funcs as AditivoDiaFuncionarioItem[],
          justificativa: j,
          impacto: {
            ...impactoGlobal,
            valor_diaria: segDiaria,
            valor_refeicao: segRef,
            total: segDiaria + segRef,
          },
        });
      }
      // 2) Remover dia (por data)
      for (const [dia, funcs] of diff.removerPorData) {
        await solicitarDia.mutateAsync({
          solicitacaoId: solicitacao.id,
          dataAjustada: dia,
          acao: "remover_dia",
          funcionarios: funcs,
          justificativa: j,
          impacto: { ...impactoGlobal },
        });
      }
      // 3) Funcionário NOVO (por par)
      for (const par of diff.novoFuncPares) {
        const segDiaria = par.snapshot.valor_diaria ?? 0;
        const segRef = par.snapshot.valor_refeicao ?? 0;
        await solicitarFunc.mutateAsync({
          solicitacaoId: solicitacao.id,
          funcionarioId: par.funcionario_id,
          dataAjustada: par.dia,
          snapshotFuncionario: par.snapshot,
          justificativa: j,
          impacto: {
            ...impactoGlobal,
            valor_diaria: segDiaria,
            valor_refeicao: segRef,
            total: segDiaria + segRef,
          },
        });
      }
      onOpenChange(false);
    } catch {
      // toasts já são emitidos pelos hooks
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Solicitação de Aditivo de Diária
          </DialogTitle>
          <DialogDescription>
            Ajuste os dias e a equipe. A solicitação só será alterada após aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
          {/* 1. Cabeçalho compacto */}
          <Card>
            <CardContent className="py-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Nº
                  </p>
                  <p className="font-mono font-semibold text-primary">
                    {solicitacao.numero_solicitacao}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Centro de Custo
                  </p>
                  <p className="font-medium truncate">
                    {solicitacao.bd_centros_custo?.codigo_centro_custo} —{" "}
                    {solicitacao.bd_centros_custo?.nome_centro_custo}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {formatBrazilianDateForDisplay(solicitacao.data_inicio)} →{" "}
                    {formatBrazilianDateForDisplay(solicitacao.data_fim)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Status
                  </p>
                  <Badge variant="default" className="capitalize">
                    {solicitacao.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Dias solicitados para trabalho */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Dias solicitados para trabalho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">
                Clique para alternar o dia para toda a equipe.{" "}
                <span className="text-emerald-700 dark:text-emerald-300">
                  verde
                </span>{" "}
                = planejado;{" "}
                <span className="text-muted-foreground">cinza</span> = não
                planejado. Dias passados ficam bloqueados.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dias.map((d) => {
                  const ativo = d === diaAtivo;
                  const algumPropMarcado = Array.from(proposto.values()).some(
                    (s) => s.has(d),
                  );
                  const algumAtualMarcado = diasPlanejadosAtual.has(d);
                  const passado = d < hoje;
                  const bloqueado = passado && !permiteRetroativo;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDiaAtivo(d);
                        toggleDiaGlobal(d);
                      }}
                      disabled={bloqueado}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-xs border transition-all flex flex-col items-center min-w-[52px]",
                        algumPropMarcado &&
                          "bg-emerald-500/10 border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
                        !algumPropMarcado &&
                          !passado &&
                          "bg-muted/30 border-border text-muted-foreground hover:bg-muted",
                        passado && "opacity-50 cursor-not-allowed bg-muted/40",
                        ativo && "ring-2 ring-primary ring-offset-1",
                        !algumAtualMarcado &&
                          algumPropMarcado &&
                          "border-dashed",
                      )}
                      title={
                        passado
                          ? "Dia passado — não pode ser alterado"
                          : `${fmtDow(d)} ${fmtDM(d)}`
                      }
                    >
                      <span className="text-[10px] uppercase leading-none">
                        {fmtDow(d)}
                      </span>
                      <span className="font-semibold leading-tight">
                        {fmtDM(d)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 3. Busca de funcionários */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Adicionar funcionário ao aditivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={buscaFunc}
                  onChange={(e) => setBuscaFunc(e.target.value)}
                  placeholder="Buscar funcionário por nome (mín. 2 letras)..."
                  className="pl-8"
                />
              </div>
              {buscaFunc.trim().length >= 2 && (
                <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                  {buscaQ.isLoading ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                      Buscando...
                    </div>
                  ) : (buscaQ.data ?? []).length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </div>
                  ) : (
                    (buscaQ.data ?? []).map((row: any) => {
                      const jaExiste = linhas.some(
                        (l) => l.funcionario_id === row.id,
                      );
                      return (
                        <button
                          key={row.id}
                          type="button"
                          disabled={jaExiste}
                          onClick={() => adicionarFuncionario(row)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-2 border-b last:border-b-0",
                            jaExiste && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <div>
                            <div className="font-medium">
                              {row.nome_completo}
                            </div>
                            <div className="text-muted-foreground">
                              {row.bd_funcoes?.nome_funcao ?? "—"}{" "}
                              {row.matricula ? `• Mat. ${row.matricula}` : ""}
                            </div>
                          </div>
                          {jaExiste && (
                            <Badge variant="secondary" className="text-[10px]">
                              já na lista
                            </Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Equipe por dia */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Equipe por dia
                  <Badge variant="secondary" className="text-[10px]">
                    {dias.length} dias • {linhas.length} func.
                  </Badge>
                </CardTitle>
                <div className="relative w-full sm:w-[260px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Filtrar por nome ou função…"
                    className="h-8 pl-7 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {linhas.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">
                  Nenhum funcionário na matriz. Use a busca acima para adicionar.
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 bg-background">
                      <TableRow>
                        <TableHead className="text-xs sticky left-0 bg-background z-30 min-w-[200px]">
                          Funcionário
                        </TableHead>
                        {dias.map((d) => (
                          <TableHead
                            key={d}
                            className={cn(
                              "text-xs text-center min-w-[50px]",
                              d === diaAtivo && "bg-primary/5 font-semibold",
                              d < hoje && "bg-muted/30",
                            )}
                          >
                            <div className="leading-tight">
                              <div className="text-[9px] uppercase text-muted-foreground">
                                {fmtDow(d)}
                              </div>
                              <div>{fmtDM(d)}</div>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-xs text-right w-[50px]">
                          
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhasFiltradas.map((l) => {
                        const propostoSet = proposto.get(l.funcionario_id) ?? new Set();
                        const atualSet = atualPorFunc.get(l.funcionario_id) ?? new Set();
                        return (
                          <TableRow key={l.funcionario_id}>
                            <TableCell className="text-xs sticky left-0 bg-background z-10 min-w-[200px]">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {l.nome_funcionario}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
                                  {l.nome_funcao ?? "—"}
                                </span>
                                {!l.existente && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] mt-0.5 w-fit border-primary text-primary"
                                  >
                                    NOVO
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            {dias.map((d) => {
                              const marcado = propostoSet.has(d);
                              const eraAprovado = atualSet.has(d);
                              const temPresenca = presencasReais.has(
                                `${l.funcionario_id}|${d}`,
                              );
                              const passado = d < hoje;
                              const disabled = (passado && !permiteRetroativo) || temPresenca;
                              const cellChanged = marcado !== eraAprovado;
                              return (
                                <TableCell
                                  key={d}
                                  className={cn(
                                    "text-center",
                                    d === diaAtivo && "bg-primary/5",
                                    disabled && "bg-muted/30",
                                    cellChanged &&
                                      (marcado
                                        ? "bg-emerald-500/10"
                                        : "bg-red-500/10"),
                                  )}
                                >
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex">
                                          <Checkbox
                                            checked={marcado}
                                            disabled={disabled}
                                            onCheckedChange={() =>
                                              togglePar(l.funcionario_id, d)
                                            }
                                          />
                                        </span>
                                      </TooltipTrigger>
                                      {(temPresenca || passado) && (
                                        <TooltipContent className="text-xs max-w-[220px]">
                                          {temPresenca
                                            ? "Presença real registrada — não pode ser removida."
                                            : "Data passada — não pode ser alterada."}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => removerLinha(l.funcionario_id)}
                                title="Remover funcionário do aditivo"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/60" />
                  Alteração: adição
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500/60" />
                  Alteração: remoção
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted/50 border" />
                  Bloqueado (passado/presença real)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 5. Justificativa */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Justificativa do aditivo</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={
                  temOperacaoRetroativa
                    ? "Mínimo 20 caracteres (operação retroativa). Detalhe o motivo da regularização."
                    : "Mínimo 5 caracteres. Explique o motivo do ajuste."
                }
                rows={3}
              />
              {justInvalida && justificativa.length > 0 && (
                <p className="text-xs text-destructive mt-1">
                  Mínimo {tamanhoMinJust} caracteres
                  {temOperacaoRetroativa ? " (operação retroativa)" : ""}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 6. Resumo do impacto */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 space-y-2 text-sm">
              <div className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Resumo do impacto financeiro estimado
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Valor atual aprovado
                  </p>
                  <p className="font-medium">{formatCurrency(impacto.atual)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Valor proposto após aditivo
                  </p>
                  <p className="font-medium">
                    {formatCurrency(impacto.proposto)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Diferença</p>
                  <p
                    className={cn(
                      "font-bold",
                      impacto.diferenca > 0 && "text-emerald-700",
                      impacto.diferenca < 0 && "text-red-700",
                    )}
                  >
                    {impacto.diferenca > 0 && "+"}
                    {formatCurrency(impacto.diferenca)}
                  </p>
                </div>
              </div>
              <EstimativaAviso variant="compact" />
            </CardContent>
          </Card>

          {/* Alertas de validação */}
          {remocoesBloqueadas.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Existem remoções bloqueadas por presença real registrada. Desfaça
                as remoções nessas células antes de continuar (
                {remocoesBloqueadas.length}{" "}
                {remocoesBloqueadas.length === 1 ? "ocorrência" : "ocorrências"}
                ).
              </AlertDescription>
            </Alert>
          )}
          {remocoesRetroativas.length > 0 && !permiteRetroativo && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Remoção retroativa não é permitida para o seu perfil.
              </AlertDescription>
            </Alert>
          )}
          {adicoesRetroativas.length > 0 && !permiteRetroativo && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Adição retroativa não é permitida para o seu perfil (dias:{" "}
                {adicoesRetroativas.map(fmtDM).join(", ")}).
              </AlertDescription>
            </Alert>
          )}
          {temOperacaoRetroativa && permiteRetroativo && (
            <Alert className="border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Regularização retroativa — ação auditada.</strong>{" "}
                Esta solicitação contém ajustes em datas passadas
                {adicoesRetroativas.length > 0 && (
                  <> (adição: {adicoesRetroativas.map(fmtDM).join(", ")})</>
                )}
                {remocoesRetroativas.length > 0 && (
                  <> (remoções: {remocoesRetroativas.length})</>
                )}
                . Justificativa de no mínimo 20 caracteres é obrigatória; o
                evento ficará registrado em <code>bd_diaria_logs</code> /{" "}
                <code>bd_diaria_aditivos.retroativo</code>.
              </AlertDescription>
            </Alert>
          )}
          {totalMudancas === 0 && (
            <Alert>
              <AlertDescription className="text-xs">
                Nenhuma alteração detectada em relação ao planejamento atual.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMutating}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!podeConfirmar}>
            {isMutating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Solicitar Aditivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
