// Fase 6G.2 — Modal de visualização da estrutura EAP/WBS importada.
import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Info, Search } from "lucide-react";
import type { AtividadePlanejada } from "@/types/planejamentoMacro";
import {
  construirArvoreWbs,
  compararCodigoWbs,
  type WbsNode,
} from "@/lib/planejamentoMacro/wbs/construirArvoreWbs";
import { formatarDataBR } from "../shared/formatData";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atividades: AtividadePlanejada[];
}

function matchNo(no: WbsNode, q: string): boolean {
  if (!q) return true;
  if (no.codigo.toLowerCase().includes(q)) return true;
  const nome = no.atividade?.nome?.toLowerCase() ?? "";
  if (nome.includes(q)) return true;
  return no.filhos.some((f) => matchNo(f, q));
}

const NoLinha: React.FC<{
  no: WbsNode;
  q: string;
  expandidos: Set<string>;
  toggle: (k: string) => void;
}> = ({ no, q, expandidos, toggle }) => {
  const aberto = expandidos.has(no.key);
  const temFilhos = no.filhos.length > 0;
  const visivel = matchNo(no, q);
  if (!visivel) return null;

  const a = no.atividade;
  const indent = (no.nivel - 1) * 16;

  return (
    <>
      <div
        className="flex items-start gap-2 py-1.5 border-b border-border/40 hover:bg-muted/30"
        style={{ paddingLeft: indent + 8 }}
      >
        <div className="w-5 shrink-0 pt-0.5">
          {temFilhos ? (
            <button
              type="button"
              onClick={() => toggle(no.key)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={aberto ? "Recolher" : "Expandir"}
            >
              {aberto ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>

        <Badge
          variant="outline"
          className="font-mono text-[11px] shrink-0 mt-0.5"
        >
          {no.codigo}
        </Badge>

        <div className="flex-1 min-w-0">
          {no.virtual ? (
            <span className="text-sm italic text-muted-foreground">
              (nível ausente no arquivo) — agrupador visual
            </span>
          ) : (
            <>
              <div className="text-sm font-medium truncate">
                {a?.nome ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {a?.inicio && a?.fim && (
                  <span>
                    {formatarDataBR(a.inicio)} — {formatarDataBR(a.fim)}
                  </span>
                )}
                {a?.frente && <span>Frente: {a.frente}</span>}
              </div>
            </>
          )}
        </div>

        {!no.virtual && a?.status && (
          <Badge
            variant={
              (a.status_tecnico ?? "").toLowerCase() === "cancelada"
                ? "destructive"
                : "outline"
            }
            className="shrink-0"
          >
            {a.status}
          </Badge>
        )}
      </div>

      {temFilhos && aberto && (
        <>
          {no.filhos.map((f) => (
            <NoLinha
              key={f.key}
              no={f}
              q={q}
              expandidos={expandidos}
              toggle={toggle}
            />
          ))}
        </>
      )}
    </>
  );
};

const EstruturaWbsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  atividades,
}) => {
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const arvore = useMemo(() => construirArvoreWbs(atividades), [atividades]);

  const todasChavesComFilhos = useMemo(() => {
    const acc: string[] = [];
    const visit = (n: WbsNode) => {
      if (n.filhos.length > 0) acc.push(n.key);
      n.filhos.forEach(visit);
    };
    arvore.raizes.forEach(visit);
    return acc;
  }, [arvore]);

  const toggle = (k: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const expandirTudo = () => setExpandidos(new Set(todasChavesComFilhos));
  const recolherTudo = () => setExpandidos(new Set());

  const q = busca.trim().toLowerCase();
  const expandidosEfetivo = q ? new Set(todasChavesComFilhos) : expandidos;

  const listaPlanaSemHierarquia = useMemo(() => {
    if (arvore.hierarquicoDetectado) return [];
    return [...atividades]
      .filter((a) => !!a.codigo_wbs?.trim())
      .sort((a, b) =>
        compararCodigoWbs(a.codigo_wbs ?? "", b.codigo_wbs ?? "")
      );
  }, [atividades, arvore.hierarquicoDetectado]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle title="EAP corresponde ao código WBS importado do MS Project.">
            Estrutura EAP
          </DialogTitle>
          <DialogDescription>
            Visualização hierárquica das atividades importadas a partir do
            código EAP do cronograma.
          </DialogDescription>
        </DialogHeader>

        {!arvore.hierarquicoDetectado && arvore.totalReais > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Não foi possível identificar hierarquia completa. Exibindo lista
              ordenada por EAP.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código EAP ou nome..."
              className="pl-8"
            />
          </div>
          {arvore.hierarquicoDetectado && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandirTudo}>
                Expandir tudo
              </Button>
              <Button variant="outline" size="sm" onClick={recolherTudo}>
                Recolher tudo
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {arvore.totalReais} atividade(s) com EAP
          {arvore.totalVirtuais > 0 &&
            ` • ${arvore.totalVirtuais} agrupador(es) visual(is) inferido(s)`}
          {arvore.semWbs.length > 0 &&
            ` • ${arvore.semWbs.length} sem EAP`}
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border border-border">
          {arvore.totalReais === 0 && arvore.semWbs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhuma atividade disponível.
            </div>
          ) : arvore.hierarquicoDetectado ? (
            <div className="py-1">
              {arvore.raizes.map((n) => (
                <NoLinha
                  key={n.key}
                  no={n}
                  q={q}
                  expandidos={expandidosEfetivo}
                  toggle={toggle}
                />
              ))}
            </div>
          ) : (
            <div className="py-1">
              {listaPlanaSemHierarquia
                .filter((a) => {
                  if (!q) return true;
                  return (
                    (a.codigo_wbs ?? "").toLowerCase().includes(q) ||
                    a.nome.toLowerCase().includes(q)
                  );
                })
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 py-1.5 px-2 border-b border-border/40"
                  >
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] shrink-0 mt-0.5"
                    >
                      {a.codigo_wbs}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {a.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatarDataBR(a.inicio)} — {formatarDataBR(a.fim)}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {a.status}
                    </Badge>
                  </div>
                ))}
            </div>
          )}

          {arvore.semWbs.length > 0 && (
            <div className="border-t border-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
                Sem EAP ({arvore.semWbs.length})
              </div>
              {arvore.semWbs
                .filter((a) => !q || a.nome.toLowerCase().includes(q))
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 py-1.5 px-3 border-b border-border/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {a.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatarDataBR(a.inicio)} — {formatarDataBR(a.fim)}
                        {a.frente && ` • ${a.frente}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {a.status}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EstruturaWbsDialog;
