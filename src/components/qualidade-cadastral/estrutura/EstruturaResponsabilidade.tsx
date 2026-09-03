/**
 * Estrutura de Responsabilidade — seção do dashboard da Central de Qualidade
 * Cadastral. Hierarquia SuperAdm → ADM Sede → ADM Obra → Centros de Custo,
 * derivada exclusivamente dos vínculos cadastrais de bd_centros_custo
 * (adm_sede_funcionario_id / adm_obra_funcionario_id) via uma única RPC
 * agregada (sem N+1). Score e pendências reutilizam o motor da Central.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Network, Search } from "lucide-react";
import { useQualidadeEstrutura } from "@/hooks/qualidade-cadastral/useQualidadeCadastral";
import type {
  QcEstruturaCc,
  QcEstruturaObra,
  QcEstruturaSede,
  QcFiltros,
} from "@/services/qualidadeCadastralService";
import AdmSedeNode, { SemResponsabilidadeNode } from "./AdmSedeNode";
import ResponsabilidadeDetail, { type NoSelecionado } from "./ResponsabilidadeDetail";

type Situacao = "todos" | "pendencias" | "criticas" | "score70" | "sem_sede" | "sem_obra";

interface Props {
  filtros: QcFiltros;
  onAplicarFiltros: (patch: Partial<QcFiltros>) => void;
}

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase();

export default function EstruturaResponsabilidade({ filtros, onAplicarFiltros }: Props) {
  const [aberto, setAberto] = useState(true);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todos");
  const [selecionado, setSelecionado] = useState<NoSelecionado | null>(null);

  const query = useQualidadeEstrutura(filtros, aberto);
  const data = query.data;

  const sedesFiltradas = useMemo<QcEstruturaSede[]>(() => {
    if (!data) return [];
    const b = busca.trim().toLowerCase();
    const ccOk = (cc: QcEstruturaCc) => {
      if (situacao === "pendencias" && cc.pendencias === 0) return false;
      if (situacao === "criticas" && cc.criticas === 0) return false;
      if (situacao === "score70" && cc.score >= 70) return false;
      if (situacao === "sem_sede" && cc.sede_nome) return false;
      if (situacao === "sem_obra" && cc.obra_nome) return false;
      return true;
    };
    return data.adm_sedes
      .map((sede) => {
        const sedeMatch = !b || norm(sede.sede_nome).includes(b);
        const obras = sede.adm_obras
          .map((obra) => {
            const obraMatch = sedeMatch || norm(obra.obra_nome).includes(b);
            const centros = obra.centros_custo.filter(
              (cc) =>
                ccOk(cc) &&
                (!b || obraMatch || norm(cc.codigo).includes(b) || norm(cc.nome).includes(b)),
            );
            return { ...obra, centros_custo: centros } as QcEstruturaObra;
          })
          .filter((o) => o.centros_custo.length > 0);
        return { ...sede, adm_obras: obras } as QcEstruturaSede;
      })
      .filter((s) => s.adm_obras.length > 0);
  }, [data, busca, situacao]);

  const orfaosFiltrados = useMemo<QcEstruturaCc[]>(() => {
    if (!data) return [];
    const b = busca.trim().toLowerCase();
    return data.sem_responsabilidade.centros_custo.filter((cc) => {
      if (situacao === "pendencias" && cc.pendencias === 0) return false;
      if (situacao === "criticas" && cc.criticas === 0) return false;
      if (situacao === "score70" && cc.score >= 70) return false;
      if (situacao === "sem_obra" && cc.obra_nome) return false;
      return !b || norm(cc.codigo).includes(b) || norm(cc.nome).includes(b);
    });
  }, [data, busca, situacao]);

  const vazio =
    !!data && sedesFiltradas.length === 0 && orfaosFiltrados.length === 0;

  const orfaosVisiveis = situacao === "sem_sede" || situacao === "todos" || orfaosFiltrados.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4 text-primary" /> Estrutura de Responsabilidade
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ADM Sede → ADM Obra → Centros de Custo, com o mesmo score e pendências da Central
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAberto((a) => !a)}>
          {aberto ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
          {aberto ? "Recolher" : "Mostrar"}
        </Button>
      </CardHeader>

      {aberto && (
        <CardContent className="space-y-3">
          {/* Resumo compacto */}
          {query.isLoading || !data ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { label: "ADM Sede", valor: String(data.totais.adm_sedes) },
                { label: "ADM Obra", valor: String(data.totais.adm_obras) },
                { label: "Centros de Custo", valor: String(data.totais.centros_custo) },
                {
                  label: "Pendências",
                  valor: `${data.totais.pendencias}`,
                  extra: `${data.totais.criticas} críticas`,
                },
              ].map((k) => (
                <div key={k.label} className="rounded-md border border-border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-semibold leading-tight tabular-nums">{k.valor}</p>
                  {k.extra && <p className="text-[11px] text-destructive">{k.extra}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Filtros locais */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar ADM Sede, ADM Obra, código ou nome do CC"
                className="h-9 pl-8"
                aria-label="Buscar na estrutura de responsabilidade"
              />
            </div>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
              <SelectTrigger className="h-9 sm:w-56">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendencias">Com pendências</SelectItem>
                <SelectItem value="criticas">Com críticas</SelectItem>
                <SelectItem value="score70">Score &lt; 70%</SelectItem>
                <SelectItem value="sem_sede">Sem ADM Sede</SelectItem>
                <SelectItem value="sem_obra">Sem ADM Obra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Governança / estruturas órfãs */}
          {data && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                Estruturas órfãs: {data.governanca.cc_sem_sede + data.governanca.cc_sem_obra}
              </Badge>
              <Badge variant="outline" className="text-xs">
                CC sem ADM Sede: {data.governanca.cc_sem_sede}
              </Badge>
              <Badge variant="outline" className="text-xs">
                CC sem ADM Obra: {data.governanca.cc_sem_obra}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Responsável inativo: {data.governanca.cc_responsavel_inativo}
              </Badge>
              {data.governanca.obras_multi_sede > 0 && (
                <Badge variant="outline" className="text-xs">
                  ADM Obra em mais de uma sede: {data.governanca.obras_multi_sede}
                </Badge>
              )}
            </div>
          )}

          {/* Nó raiz */}
          <div className="flex flex-col items-center">
            <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold">
              Administração Corporativa · SuperAdm
            </div>
            <div className="h-3 w-px bg-border" />
          </div>

          {query.isError ? (
            <div className="rounded-md border border-destructive/40 p-4 text-sm">
              <p className="text-destructive">Não foi possível carregar a estrutura de responsabilidade.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => query.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : query.isLoading || !data ? (
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : vazio ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma estrutura de responsabilidade encontrada para os filtros atuais.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {sedesFiltradas.map((sede) => (
                  <AdmSedeNode
                    key={sede.sede_id}
                    sede={sede}
                    onSelecionarSede={() => setSelecionado({ tipo: "sede", sede })}
                    onSelecionarObra={(obra) =>
                      setSelecionado({ tipo: "obra", obra, sedeNome: sede.sede_nome })
                    }
                    onSelecionarCc={(cc) => setSelecionado({ tipo: "cc", cc })}
                  />
                ))}
              </div>
              {orfaosVisiveis && (
                <SemResponsabilidadeNode
                  totalCc={data.sem_responsabilidade.total_cc}
                  pendencias={data.sem_responsabilidade.pendencias}
                  criticas={data.sem_responsabilidade.criticas}
                  centros={orfaosFiltrados}
                  onSelecionarCc={(cc) => setSelecionado({ tipo: "cc", cc })}
                  onFiltrar={() => onAplicarFiltros({ sem_responsavel: true, responsavel: undefined })}
                />
              )}
            </div>
          )}
        </CardContent>
      )}

      <ResponsabilidadeDetail
        selecionado={selecionado}
        onClose={() => setSelecionado(null)}
        onFiltrarResponsavel={(nome) => {
          onAplicarFiltros({ responsavel: nome, sem_responsavel: undefined, severidade: undefined });
          setSelecionado(null);
        }}
        onFiltrarCriticasResponsavel={(nome) => {
          onAplicarFiltros({ responsavel: nome, sem_responsavel: undefined, severidade: "CRITICA" });
          setSelecionado(null);
        }}
        onFiltrarCentroCusto={(ccId) => {
          onAplicarFiltros({ centro_custo_id: ccId });
          setSelecionado(null);
        }}
      />
    </Card>
  );
}
