import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Clock, ShoppingCart, XCircle, AlertTriangle, Info, ShieldAlert, RefreshCw } from "lucide-react";
import {
  fetchAnaliseOperacional,
  AnaliseOperacional,
  AtivoAnalise,
} from "@/services/centralTransporteService";
import { REGIME_LABELS, RegimeTrabalho, STATUS_ITEM_LABELS, StatusItem } from "@/services/solicitacaoItensService";
import { formatDateBR } from "@/utils/formatDateBR";
import { formatProtocolo } from "@/utils/formatProtocolo";
import type { SelectedContext } from "./CentralTransportePage";

interface Props {
  context: SelectedContext | null;
  open: boolean;
  onClose: () => void;
  onDecisaoSaved: () => void;
}

const BLOQUEIO_MSG =
  "A análise operacional já está disponível. As decisões serão liberadas após a implantação do vínculo por item e da transação segura.";

const AnaliseOperacionalSheet: React.FC<Props> = ({ context, open, onClose }) => {
  const solicitacao = context?.solicitacao ?? null;
  const item = context?.item ?? null;

  const analiseQuery = useQuery({
    enabled: !!open && !!solicitacao,
    queryKey: [
      "central-transporte-analise",
      item?.id ?? null,
      item?.subcategoria_id ?? null,
      item?.catalogo_equipamento_id ?? null,
      item?.catalogo_variacao_id ?? null,
      item?.capacidade_valor ?? null,
      item?.capacidade_unidade ?? null,
      solicitacao?.tipo_equipamento_id ?? null,
      item?.quantidade ?? solicitacao?.quantidade ?? null,
    ],
    queryFn: (): Promise<AnaliseOperacional> =>
      fetchAnaliseOperacional({
        tipoEquipamentoId: solicitacao?.tipo_equipamento_id ?? null,
        catalogoEquipamentoId: item?.catalogo_equipamento_id ?? null,
        catalogoVariacaoId: item?.catalogo_variacao_id ?? null,
        subcategoriaId: item?.subcategoria_id ?? null,
        capacidadeValor: item?.capacidade_valor ?? null,
        capacidadeUnidade: item?.capacidade_unidade ?? null,
        quantidade: item?.quantidade ?? solicitacao?.quantidade ?? null,
      }),
  });

  if (!solicitacao) return null;

  const analise = analiseQuery.data;
  const loading = analiseQuery.isLoading || analiseQuery.isFetching;
  const isLegado = !item;

  const capacidadeLabel =
    item?.capacidade_valor != null
      ? `${item.capacidade_valor}${item.capacidade_unidade ? ` ${item.capacidade_unidade}` : ""}`
      : ((item as { capacidade_descricao?: string | null } | null)?.capacidade_descricao) || "—";


  const descricaoItem =
    item?.item_nao_catalogado
      ? item.descricao_livre || "Não catalogado"
      : item?.subcategoria_nome
        ? `${item.subcategoria_nome}${capacidadeLabel !== "—" ? ` — ${capacidadeLabel}` : ""}`
        : item?.catalogo_descricao || solicitacao.descricao_tipo_equipamento || "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxWidth: "min(1280px, 96vw)", width: "min(1280px, 96vw)", maxHeight: "92vh" }}
      >
        <DialogHeader className="px-6 py-4 border-b space-y-3 shrink-0">
          <DialogTitle className="text-base flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
              {formatProtocolo(solicitacao.id)}
            </span>
            <span className="truncate">{descricaoItem}</span>
            {item && <Badge variant="outline" className="text-[10px]">{item.tipo_item}</Badge>}
            {item && (
              <Badge className="text-[10px]" variant="outline">
                {STATUS_ITEM_LABELS[item.status_item as StatusItem] || item.status_item}
              </Badge>
            )}
          </DialogTitle>

          {isLegado && (
            <Alert variant="default" className="py-2">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Esta solicitação ainda usa o modelo legado (sem item selecionado). A análise usa apenas o tipo genérico do cabeçalho.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <MetaField label="Quantidade" value={String(item?.quantidade ?? solicitacao.quantidade)} />
            <MetaField label="Capacidade" value={capacidadeLabel} />
            <MetaField
              label="Regime"
              value={item?.regime_trabalho ? (REGIME_LABELS[item.regime_trabalho as RegimeTrabalho] || item.regime_trabalho) : "—"}
            />
            <MetaField label="Operador" value={item?.com_operador ? "Com operador" : "Sem operador"} />
            <MetaField label="Centro de Custo" value={solicitacao.nome_centro_custo || "—"} />
            <MetaField label="Departamento" value={solicitacao.departamento_nome || "—"} />
            <MetaField label="Engenheiro" value={solicitacao.engenheiro_nome || "—"} />
            <MetaField label="Apontador" value={solicitacao.apontador_nome || "—"} />
            <MetaField label="Prioridade" value={solicitacao.prioridade} />
            <MetaField
              label="Período"
              value={solicitacao.data_inicio ? formatDateBR(solicitacao.data_inicio) : "—"}
            />
            <MetaField label="Status Fluxo" value={solicitacao.status_fluxo.replace(/_/g, " ")} />
            <MetaField label="Compatibilidade" value={analise?.resumo?.compatibilidade || "—"} />
          </div>

          {solicitacao.justificativa && (
            <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30 max-h-16 overflow-auto">
              <strong className="text-foreground">Justificativa: </strong>
              {solicitacao.justificativa}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
          ) : analise ? (
            <AnaliseBody analise={analise} onRetry={() => analiseQuery.refetch()} />
          ) : null}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30 shrink-0 space-y-2">
          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{BLOQUEIO_MSG}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button disabled title={BLOQUEIO_MSG} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Atender Interno
            </Button>
            <Button disabled variant="secondary" title={BLOQUEIO_MSG} className="gap-2">
              <Clock className="h-4 w-4" /> Reservar Futuro
            </Button>
            <Button disabled variant="outline" title={BLOQUEIO_MSG} className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Cotação Externa
            </Button>
            <Button disabled variant="destructive" title={BLOQUEIO_MSG} className="gap-2">
              <XCircle className="h-4 w-4" /> Indisponível
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MetaField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[10px] uppercase tracking-wide">{label}</span>
    <span className="text-foreground text-xs truncate">{value}</span>
  </div>
);

const AnaliseBody: React.FC<{ analise: AnaliseOperacional; onRetry: () => void }> = ({ analise, onRetry }) => {
  if (analise.status === "erro_consulta") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro ao consultar</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span className="text-xs">{analise.errorMessage || "Falha ao consultar dados."}</span>
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "acesso_negado") {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso negado</AlertTitle>
        <AlertDescription className="text-xs">
          Você não tem permissão para consultar esta informação. Solicite acesso ao administrador.
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "item_sem_classificacao") {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Item sem classificação</AlertTitle>
        <AlertDescription className="text-xs">
          O item não possui subcategoria, catálogo, variação ou tipo de equipamento. Sem esses dados, a Central não pode identificar ativos compatíveis.
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "sem_ativos_cadastrados") {
    return (
      <>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Sem ativos compatíveis cadastrados</AlertTitle>
          <AlertDescription className="text-xs">
            Nenhum equipamento do inventário próprio, grupo ou locado corresponde a este item.
            {analise.portfolioExterno.length > 0 && " Consulte os fornecedores externos abaixo."}
          </AlertDescription>
        </Alert>
        {analise.portfolioExterno.length > 0 && <PortfolioTable rows={analise.portfolioExterno} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="propria">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="propria" className="text-xs">
            Própria ({analise.disponibilidadePropria.length})
          </TabsTrigger>
          <TabsTrigger value="grupo" className="text-xs">
            Grupo ({analise.disponibilidadeGrupo.length})
          </TabsTrigger>
          <TabsTrigger value="previsao" className="text-xs">
            Previsão ({analise.equipamentosComPrevisao.length})
          </TabsTrigger>
          <TabsTrigger value="externo" className="text-xs">
            Externo ({analise.externoLocado.length + analise.portfolioExterno.length})
          </TabsTrigger>
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="propria">
          <AtivosTable rows={analise.disponibilidadePropria} empty="Nenhum equipamento próprio disponível." />
        </TabsContent>
        <TabsContent value="grupo">
          <AtivosTable rows={analise.disponibilidadeGrupo} empty="Nenhum equipamento do grupo disponível." />
        </TabsContent>
        <TabsContent value="previsao">
          <PrevisaoTable rows={analise.equipamentosComPrevisao} />
        </TabsContent>
        <TabsContent value="externo" className="space-y-4">
          {analise.externoLocado.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Ativos locados cadastrados
              </h4>
              <AtivosTable rows={analise.externoLocado} empty="—" />
            </div>
          )}
          {analise.portfolioExterno.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Fornecedores do portfólio
              </h4>
              <PortfolioTable rows={analise.portfolioExterno} />
            </div>
          )}
          {analise.externoLocado.length === 0 && analise.portfolioExterno.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              Nenhum ativo locado nem fornecedor externo compatível.
            </div>
          )}
        </TabsContent>
        <TabsContent value="resumo">
          <ResumoBox analise={analise} />
        </TabsContent>
      </Tabs>

      {analise.status === "sem_disponibilidade" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sem disponibilidade no momento</AlertTitle>
          <AlertDescription className="text-xs">
            Existem {analise.totalCandidatos} ativo(s) cadastrado(s) compatível(is), mas nenhum está disponível agora e nenhum tem previsão de liberação.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

const propriedadeBadge = (p: AtivoAnalise["propriedade"]) => {
  const map: Record<string, string> = {
    PROPRIA: "bg-emerald-100 text-emerald-800",
    GRUPO: "bg-blue-100 text-blue-800",
    LOCADO: "bg-amber-100 text-amber-800",
    NAO_CLASSIFICADO: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[p] || ""}`}>{p.replace("_", " ")}</Badge>;
};

const statusBadge = (s: string | null) => {
  if (!s) return <span className="text-muted-foreground">SEM STATUS</span>;
  const map: Record<string, string> = {
    DISPONIVEL: "bg-emerald-600 text-white",
    ALOCADO: "bg-blue-600 text-white",
    MANUTENCAO: "bg-amber-600 text-white",
    INDISPONIVEL: "bg-red-600 text-white",
  };
  return <Badge className={`text-[10px] ${map[s] || ""}`}>{s}</Badge>;
};

const AtivosTable: React.FC<{ rows: AtivoAnalise[]; empty: string }> = ({ rows, empty }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Frota</TableHead>
          <TableHead className="text-xs">Nº Frota</TableHead>
          <TableHead className="text-xs">Placa</TableHead>
          <TableHead className="text-xs">Empresa</TableHead>
          <TableHead className="text-xs">Propriedade</TableHead>
          <TableHead className="text-xs">Capacidade</TableHead>
          <TableHead className="text-xs">CC atual</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Compat.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.equipamento_id}>
              <TableCell className="text-xs">{r.frota || "—"}</TableCell>
              <TableCell className="text-xs">{r.numero_frota || "—"}</TableCell>
              <TableCell className="text-xs">{r.placa || "—"}</TableCell>
              <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
              <TableCell>{propriedadeBadge(r.propriedade)}</TableCell>
              <TableCell className="text-xs">
                {r.capacidade_valor != null ? `${r.capacidade_valor} ${r.capacidade_unidade || ""}` : "—"}
              </TableCell>
              <TableCell className="text-xs">{r.centro_custo || "—"}</TableCell>
              <TableCell>{statusBadge(r.status_operacional)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{r.compatibilidade}</Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

const PrevisaoTable: React.FC<{ rows: AtivoAnalise[] }> = ({ rows }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Frota</TableHead>
          <TableHead className="text-xs">Nº Frota</TableHead>
          <TableHead className="text-xs">Propriedade</TableHead>
          <TableHead className="text-xs">CC atual</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Previsão</TableHead>
          <TableHead className="text-xs">Confiab.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
              Nenhum equipamento com previsão de liberação.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.equipamento_id}>
              <TableCell className="text-xs">{r.frota || "—"}</TableCell>
              <TableCell className="text-xs">{r.numero_frota || "—"}</TableCell>
              <TableCell>{propriedadeBadge(r.propriedade)}</TableCell>
              <TableCell className="text-xs">{r.centro_custo || "—"}</TableCell>
              <TableCell>{statusBadge(r.status_operacional)}</TableCell>
              <TableCell className="text-xs">
                {r.previsao_liberacao ? formatDateBR(r.previsao_liberacao) : "—"}
              </TableCell>
              <TableCell className="text-xs">{r.confiabilidade || "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

const PortfolioTable: React.FC<{ rows: AnaliseOperacional["portfolioExterno"] }> = ({ rows }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Empresa</TableHead>
          <TableHead className="text-xs">Variação</TableHead>
          <TableHead className="text-xs">Qtd Estimada</TableHead>
          <TableHead className="text-xs">C/ Operador</TableHead>
          <TableHead className="text-xs">S/ Operador</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
              Nenhum fornecedor externo no portfólio.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
              <TableCell className="text-xs">{r.variacao || "—"}</TableCell>
              <TableCell className="text-xs">{r.quantidade_estimada ?? "—"}</TableCell>
              <TableCell className="text-xs">
                {r.valor_com_operador != null ? `R$ ${Number(r.valor_com_operador).toLocaleString("pt-BR")}` : "—"}
              </TableCell>
              <TableCell className="text-xs">
                {r.valor_sem_operador != null ? `R$ ${Number(r.valor_sem_operador).toLocaleString("pt-BR")}` : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

const ResumoBox: React.FC<{ analise: AnaliseOperacional }> = ({ analise }) => {
  const r = analise.resumo;
  const linhas: { k: string; v: string | number }[] = [
    { k: "Quantidade solicitada", v: r.quantidade_solicitada },
    { k: "Própria disponível", v: r.propria_disponivel },
    { k: "Grupo disponível", v: r.grupo_disponivel },
    { k: "Locada cadastrada", v: r.locado_cadastrado },
    { k: "Com previsão de liberação", v: r.com_previsao },
    { k: "Fornecedores compatíveis", v: r.fornecedores_compativeis },
    { k: "Compatibilidade", v: r.compatibilidade },
    { k: "Estratégia de matching", v: analise.matchingUsed },
  ];
  return (
    <div className="rounded-md border p-4 space-y-2 bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        {linhas.map((l) => (
          <div key={l.k} className="flex justify-between text-xs border-b py-1">
            <span className="text-muted-foreground">{l.k}</span>
            <span className="font-medium">{l.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnaliseOperacionalSheet;
