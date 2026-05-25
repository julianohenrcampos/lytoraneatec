import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Search, Trash2, Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/diariasPeriodoUtils";
import type { FuncionarioPreConvocado } from "@/types/diarias";
import type { ResultadoElegibilidade } from "@/utils/diariasElegibilidadeMatriz";

export type DadosRicosFunc = {
  funcao: string;
  valor_diaria: number;
  valor_diaria_exclusiva: number;
  valor_refeicao: number;
  matricula?: string | null;
  status?: string | null;
  alocacao?: {
    codigo_centro_custo: string;
    numero_solicitacao: string;
    severidade?: 'bloqueio' | 'alerta';
    datas_bloqueio?: string[];
    datas_alerta?: string[];
  } | null;
  bloqueadoRPC: boolean;
};

interface Props {
  convocados: FuncionarioPreConvocado[];
  diasSolicitados: string[];
  diasVerdes: string[];
  diasLaranjas: string[];
  diasPorFuncionario: Record<string, string[]>;
  diaAtivo: string | null;
  onChangeDiaAtivo: (d: string) => void;
  onToggle: (funcId: string, data: string) => void;
  onRemover: (funcId: string) => void;
  diasSemEquipe: string[];
  elegibilidadeCelulaMap?: Map<string, Map<string, ResultadoElegibilidade>>;
  dadosRicosPorFuncionario: Record<string, DadosRicosFunc>;
}

const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function classificarStatus(dados?: DadosRicosFunc) {
  const s = norm(dados?.status);
  return {
    isFerias: s === "ferias",
    isInativo: s.includes("inativ") || s.includes("desligad"),
    isInss: s.includes("inss") || s.includes("afastad") || s.includes("auxilio"),
  };
}

function badgesDoFuncionario(dados: DadosRicosFunc | undefined) {
  if (!dados) return [] as Array<{ label: string; variant: any; className?: string }>;
  const out: Array<{ label: string; variant: any; className?: string }> = [];
  const { isFerias, isInativo, isInss } = classificarStatus(dados);
  if (dados.matricula) {
    out.push({
      label: "Remessa",
      variant: "outline",
      className: "border-amber-400 text-amber-700 dark:text-amber-300",
    });
  } else {
    out.push({ label: "Sem matrícula", variant: "outline" });
  }
  if (isFerias) out.push({ label: "Férias", variant: "default" });
  if (isInss) out.push({ label: "INSS", variant: "secondary" });
  if (isInativo) out.push({ label: "Inativo", variant: "secondary" });
  if (dados.alocacao) {
    if (dados.alocacao.severidade === 'bloqueio') {
      out.push({ label: "Conflito", variant: "destructive" });
    } else {
      out.push({
        label: "Alerta",
        variant: "outline",
        className: "border-amber-400 text-amber-700 dark:text-amber-300",
      });
    }
  }
  if (dados.bloqueadoRPC) out.push({ label: "Bloqueado", variant: "destructive" });
  return out;
}

interface RowProps {
  c: FuncionarioPreConvocado;
  dias: string[];
  diaAtivo: string | null;
  lista: string[];
  dados: DadosRicosFunc | undefined;
  elegibilidadeDoFunc?: Map<string, ResultadoElegibilidade>;
  onToggle: (funcId: string, data: string) => void;
  onRemover: (funcId: string) => void;
}

const MatrizRow = memo(function MatrizRow({
  c,
  dias,
  diaAtivo,
  lista,
  dados,
  elegibilidadeDoFunc,
  onToggle,
  onRemover,
}: RowProps) {
  const badges = badgesDoFuncionario(dados);
  return (
    <TableRow>
      <TableCell className="text-xs sticky left-0 bg-background z-10 min-w-[220px]">
        <div className="flex flex-col gap-1">
          <HoverCard openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className="font-medium cursor-default underline-offset-2 hover:underline decoration-dotted">
                {c.nome_funcionario}
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="w-72 text-xs">
              <div className="space-y-2">
                <div>
                  <div className="font-semibold text-sm leading-tight">
                    {c.nome_funcionario}
                  </div>
                  <div className="text-muted-foreground">
                    {dados?.funcao ?? c.nome_funcao}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Diária</span>
                  <span className="text-right">{formatCurrency(dados?.valor_diaria ?? c.valor_diaria)}</span>
                  <span className="text-muted-foreground">FDS/Fer</span>
                  <span className="text-right">
                    {formatCurrency(
                      dados?.valor_diaria_exclusiva ?? (c.valor_diaria_exclusiva || c.valor_diaria * 1.2),
                    )}
                  </span>
                  <span className="text-muted-foreground">Refeição</span>
                  <span className="text-right">{formatCurrency(dados?.valor_refeicao ?? c.valor_refeicao ?? 0)}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-right">{dados?.status ?? "—"}</span>
                  {dados?.matricula && (
                    <>
                      <span className="text-muted-foreground">Matrícula</span>
                      <span className="text-right">{dados.matricula}</span>
                    </>
                  )}
                </div>
                {dados?.alocacao && (
                  dados.alocacao.severidade === 'bloqueio' ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px]">
                      <div className="font-medium text-destructive">Conflito (apontamento real)</div>
                      <div>
                        CC {dados.alocacao.codigo_centro_custo} — {dados.alocacao.numero_solicitacao}
                      </div>
                      {!!dados.alocacao.datas_bloqueio?.length && (
                        <div className="mt-0.5 text-muted-foreground">
                          Datas: {dados.alocacao.datas_bloqueio.map((d) => d.split('-').reverse().join('/')).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-400/50 bg-amber-500/5 p-2 text-[11px]">
                      <div className="font-medium text-amber-700 dark:text-amber-300">Planejado em outra solicitação</div>
                      <div>
                        CC {dados.alocacao.codigo_centro_custo} — {dados.alocacao.numero_solicitacao}
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        Sem apontamento real. Inclusão liberada.
                      </div>
                    </div>
                  )
                )}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {badges.map((b) => (
                      <Badge
                        key={b.label}
                        variant={b.variant}
                        className={cn("text-[10px] px-1 py-0", b.className)}
                      >
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
          {badges.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {badges.slice(0, 4).map((b) => (
                <Badge
                  key={b.label}
                  variant={b.variant}
                  className={cn("text-[9px] px-1 py-0 leading-tight", b.className)}
                >
                  {b.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      {dias.map((d) => {
        const eleg = elegibilidadeDoFunc?.get(d);
        const podeMarcar = eleg ? eleg.podeMarcar : true;
        const tooltip = eleg?.tooltip;
        const isConflito =
          eleg?.motivo === "conflito" || eleg?.motivo === "bloqueado_rpc";
        const checkbox = (
          <Checkbox
            checked={lista.includes(d)}
            disabled={!podeMarcar}
            onCheckedChange={() => podeMarcar && onToggle(c.funcionario_id, d)}
          />
        );
        return (
          <TableCell
            key={d}
            className={cn(
              "text-center",
              d === diaAtivo && "bg-primary/5",
              !podeMarcar && "bg-muted/30 cursor-not-allowed",
              isConflito && "ring-1 ring-destructive/40",
            )}
          >
            {tooltip ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">{checkbox}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[220px]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              checkbox
            )}
          </TableCell>
        );
      })}
      <TableCell className="text-right">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onRemover(c.funcionario_id)}
                aria-label={`Remover ${c.nome_funcionario}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Remover funcionário da solicitação
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
});

export function MatrizFuncionarioData({
  convocados,
  diasSolicitados,
  diasVerdes,
  diasLaranjas,
  diasPorFuncionario,
  diaAtivo,
  onChangeDiaAtivo,
  onToggle,
  onRemover,
  diasSemEquipe,
  elegibilidadeCelulaMap,
  dadosRicosPorFuncionario,
}: Props) {
  const [filtro, setFiltro] = useState("");
  const dias = useMemo(() => [...diasSolicitados].sort(), [diasSolicitados]);

  const contagemPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dias) map[d] = 0;
    for (const lista of Object.values(diasPorFuncionario)) {
      for (const d of lista) {
        if (d in map) map[d] += 1;
      }
    }
    return map;
  }, [dias, diasPorFuncionario]);

  const semEquipeSet = useMemo(() => new Set(diasSemEquipe), [diasSemEquipe]);
  const verdeSet = useMemo(() => new Set(diasVerdes), [diasVerdes]);
  const laranjaSet = useMemo(() => new Set(diasLaranjas), [diasLaranjas]);

  const convocadosFiltrados = useMemo(() => {
    const q = norm(filtro);
    if (!q) return convocados;
    return convocados.filter((c) => {
      const dados = dadosRicosPorFuncionario[c.funcionario_id];
      if (norm(c.nome_funcionario).includes(q)) return true;
      if (norm(dados?.funcao ?? c.nome_funcao).includes(q)) return true;
      if (norm(dados?.status).includes(q)) return true;
      if (dados?.matricula && norm("remessa").includes(q)) return true;
      if (!dados?.matricula && norm("sem matricula").includes(q)) return true;
      if (dados?.alocacao && "conflito".includes(q)) return true;
      if (dados?.bloqueadoRPC && "bloqueado".includes(q)) return true;
      const { isFerias, isInativo, isInss } = classificarStatus(dados);
      if (isFerias && "ferias".includes(q)) return true;
      if (isInativo && "inativo".includes(q)) return true;
      if (isInss && "inss".includes(q)) return true;
      return false;
    });
  }, [filtro, convocados, dadosRicosPorFuncionario]);

  if (dias.length === 0 || convocados.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Equipe por dia
            <Badge variant="secondary" className="text-[10px]">
              {dias.length} {dias.length === 1 ? "dia" : "dias"} •{" "}
              {convocados.length} func.
              {filtro && convocadosFiltrados.length !== convocados.length && (
                <span className="ml-1 text-muted-foreground">
                  ({convocadosFiltrados.length} visíveis)
                </span>
              )}
            </Badge>
          </CardTitle>
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por nome, função ou status…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {diasSemEquipe.length > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Sem equipe nos dias:{" "}
              <strong>{diasSemEquipe.map(fmt).join(", ")}</strong>. Adicione ao
              menos 1 funcionário em cada dia para avançar.
            </AlertDescription>
          </Alert>
        )}

        {/* Chips de dias */}
        <div className="flex flex-wrap gap-1.5">
          {dias.map((d) => {
            const ativo = d === diaAtivo;
            const verde = verdeSet.has(d);
            const laranja = laranjaSet.has(d);
            const semEq = semEquipeSet.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChangeDiaAtivo(d)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs border transition-all flex items-center gap-1.5",
                  verde &&
                    "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                  laranja &&
                    "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300",
                  ativo && "ring-2 ring-primary ring-offset-1",
                  semEq && "ring-2 ring-destructive",
                )}
              >
                <span className="font-medium">{fmt(d)}</span>
                <Badge
                  variant={contagemPorDia[d] === 0 ? "destructive" : "secondary"}
                  className="text-[9px] px-1 py-0 h-4"
                >
                  {contagemPorDia[d]}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Tabela matriz */}
        <div className="max-h-[420px] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background">
              <TableRow>
                <TableHead className="text-xs sticky left-0 bg-background z-30 min-w-[220px]">
                  Funcionário
                </TableHead>
                {dias.map((d) => (
                  <TableHead
                    key={d}
                    className={cn(
                      "text-xs text-center",
                      d === diaAtivo && "bg-primary/5 font-semibold",
                    )}
                  >
                    {fmt(d)}
                  </TableHead>
                ))}
                <TableHead className="text-xs text-right w-[60px]">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convocadosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={dias.length + 2}
                    className="text-center text-xs text-muted-foreground py-6"
                  >
                    Nenhum funcionário corresponde ao filtro "{filtro}".
                  </TableCell>
                </TableRow>
              ) : (
                convocadosFiltrados.map((c) => (
                  <MatrizRow
                    key={c.funcionario_id}
                    c={c}
                    dias={dias}
                    diaAtivo={diaAtivo}
                    lista={diasPorFuncionario[c.funcionario_id] ?? []}
                    dados={dadosRicosPorFuncionario[c.funcionario_id]}
                    elegibilidadeDoFunc={elegibilidadeCelulaMap?.get(
                      c.funcionario_id,
                    )}
                    onToggle={onToggle}
                    onRemover={onRemover}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/60" />
            Dia normal
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-500/60" />
            Ponte/feriado operacional
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm ring-2 ring-destructive" />
            Sem equipe
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
