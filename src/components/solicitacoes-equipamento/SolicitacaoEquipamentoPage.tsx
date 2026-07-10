import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import OrigemPlanejamentoMacroBanner from "./OrigemPlanejamentoMacroBanner";
import { CheckCircle, XCircle, Plus, Truck, Construction, Wrench, Boxes, CircleDot, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSolicitacoesEquipamento,
  createSolicitacaoEquipamento,
  aprovarSolicitacaoEquipamento,
  negarSolicitacaoEquipamento,
  excluirSolicitacaoEquipamento,
  checkHistoricoCriticoSolicitacao,
  SolicitacaoEquipamentoInsert,
  SolicitacaoEquipamento,
} from "@/services/solicitacaoEquipamentoService";
import { insertItensSolicitacao, SolicitacaoItemInsert } from "@/services/solicitacaoItensService";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import SolicitacaoEquipamentoFilters from "./SolicitacaoEquipamentoFilters";
import SolicitacaoEquipamentoTable from "./SolicitacaoEquipamentoTable";
import SolicitacaoEquipamentoFormModal from "./SolicitacaoEquipamentoFormModal";
import SolicitacaoEquipamentoViewModal from "./SolicitacaoEquipamentoViewModal";
import SolicitacaoMatchingResultModal from "./SolicitacaoMatchingResultModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTiposEquipamentoDropdown } from "@/hooks/vehicles/useRelacionalDropdowns";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatItemDisplay, isNaoCadastrado } from "@/utils/solicitacaoItemDisplay";


type CardDef = { label: string; match: string[]; icon: LucideIcon; isOutros?: boolean };

const CARDS: CardDef[] = [
  { label: "Caminhões",              match: ["caminhao", "caminhão", "caminhoes"],                     icon: Truck },
  { label: "Escavadeiras",           match: ["escavadeira"],                                            icon: Construction },
  { label: "Pás Carregadeiras",      match: ["pa carregadeira", "pá carregadeira", "carregadeira"],    icon: Construction },
  { label: "Tratores de Esteira",    match: ["trator de esteira", "esteira"],                          icon: Construction },
  { label: "Retroescavadeiras",      match: ["retro"],                                                  icon: Construction },
  { label: "Guindastes",             match: ["guindaste"],                                              icon: Construction },
  { label: "Rolos Compactadores",    match: ["rolo"],                                                   icon: CircleDot },
  { label: "Plataformas/Elevadores", match: ["plataforma", "elevador"],                                 icon: Wrench },
  { label: "Geradores",              match: ["gerador"],                                                icon: Zap },
  { label: "Outros Equipamentos",    match: [],                                                          icon: Boxes, isOutros: true },
];

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const SolicitacaoEquipamentoPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const origemPlanejamentoMacro = searchParams.get("origem") === "planejamento_macro";
  const centroCustoIdOrigem = searchParams.get("centro_custo_id");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [matchingResult, setMatchingResult] = useState<any>(null);
  const [isMatchingOpen, setIsMatchingOpen] = useState(false);
  const [filters, setFilters] = useState<{ status?: string; prioridade?: string; tipo_equipamento_id?: string; status_fluxo?: string }>({});
  const [selectedTipoEquipamentoId, setSelectedTipoEquipamentoId] = useState<string | null>(null);
  const [selectedSubcategoriaId, setSelectedSubcategoriaId] = useState<string | null>(null);
  const [selectedCategoriaLabel, setSelectedCategoriaLabel] = useState<string | null>(null);
  const [selectedCategoriaMatch, setSelectedCategoriaMatch] = useState<string[]>([]);

  const resetCategoriaSelection = () => {
    setSelectedTipoEquipamentoId(null);
    setSelectedSubcategoriaId(null);
    setSelectedCategoriaLabel(null);
    setSelectedCategoriaMatch([]);
  };

  // Approval modal state
  const [approvalItem, setApprovalItem] = useState<SolicitacaoEquipamento | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const { isSuperAdmin, permissions } = usePermission();
  const { userId } = useAuth();
  const podeVerTodas = isSuperAdmin || (Array.isArray(permissions) && permissions.includes("*"));
  const [apenasMinhas, setApenasMinhas] = useState(true);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [editingSolicitacao, setEditingSolicitacao] = useState<SolicitacaoEquipamento | null>(null);
  const [viewingSolicitacao, setViewingSolicitacao] = useState<SolicitacaoEquipamento | null>(null);

  useEffect(() => {
    if (!podeVerTodas && !apenasMinhas) {
      setApenasMinhas(true);
    }
  }, [podeVerTodas, apenasMinhas]);

  const { data: tiposEquipamento = [] } = useTiposEquipamentoDropdown();

  const { data: solicitacoes = [], isLoading, isError } = useQuery({
    queryKey: ["solicitacoes-equipamento", filters, apenasMinhas],
    queryFn: () => fetchSolicitacoesEquipamento({ ...filters, apenasMinhas }),
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, itens }: { data: SolicitacaoEquipamentoInsert; itens: SolicitacaoItemInsert[] }) => {
      if (!itens || itens.length === 0) {
        throw new Error("Adicione ao menos 1 item antes de criar a solicitação.");
      }
      const inconsistente = itens.find((i) => !i.item_nao_catalogado && !i.catalogo_equipamento_id);
      if (inconsistente) {
        throw new Error("Há item inconsistente (sem catálogo e sem marca de não cadastrado). Ajuste antes de solicitar.");
      }
      const result = await createSolicitacaoEquipamento(data);
      if (itens.length > 0) {
        await insertItensSolicitacao(result.id, itens);
      }
      return { solicitacao: result, itens };
    },

    onSuccess: ({ solicitacao, itens }) => {
      console.log("[SOLIC_EQUIP][CREATE_SUCCESS]", solicitacao);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
      toast({ title: "Solicitação criada", description: "A solicitação de equipamento foi registrada com sucesso." });
      setIsFormOpen(false);
      resetCategoriaSelection();

      const itensHidratados = (itens || []).map((i: any) => ({
        ...i,
        catalogo_descricao: i.catalogo_descricao ?? null,
        subcategoria_nome: i.subcategoria_nome ?? i._subcategoriaNome ?? null,
      }));
      const itens_resumo =
        itensHidratados.length > 0
          ? `${formatItemDisplay(itensHidratados[0] as any)}${itensHidratados.length > 1 ? ` (+${itensHidratados.length - 1})` : ""}`
          : null;

      const createdWithItens: any = {
        ...solicitacao,
        itens: itensHidratados,
        itens_resumo,
      };

      console.log("[SOLIC_EQUIP][MATCHING_OPEN]", {
        solicitacao_id: (solicitacao as any)?.id,
        itens_count: itensHidratados.length,
        itens_resumo,
      });

      if (itensHidratados.length > 0) {
        setMatchingResult(createdWithItens);
        setIsMatchingOpen(true);
      }
    },
    onError: (error: Error) => {
      console.error("[SOLIC_EQUIP][CREATE_ERROR]", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = async (data: SolicitacaoEquipamentoInsert, itens: SolicitacaoItemInsert[]) => {
    console.log("[SOLIC_EQUIP][PAGE_HANDLE_CREATE]", { data, itens });
    await createMutation.mutateAsync({ data, itens });
  };

  const handleAprovar = async () => {
    if (!approvalItem) return;
    setIsApproving(true);
    try {
      await aprovarSolicitacaoEquipamento(approvalItem.id, approvalComment);
      toast({ title: "Aprovado", description: "Solicitação aprovada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
      setApprovalItem(null);
      setApprovalComment("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsApproving(false);
    }
  };

  const handleNegar = async () => {
    if (!approvalItem) return;
    setIsApproving(true);
    try {
      await negarSolicitacaoEquipamento(approvalItem.id, approvalComment);
      toast({ title: "Negado", description: "Solicitação negada." });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
      setApprovalItem(null);
      setApprovalComment("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsApproving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => excluirSolicitacaoEquipamento(id),
    onSuccess: () => {
      toast({ title: "Solicitação excluída" });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err?.message || "Falha inesperada.", variant: "destructive" });
    },
  });

  const handleDeleteRequest = async (id: string): Promise<boolean> => {
    console.log("[SOLIC_EQUIP][DELETE_CONFIRM]", { id });
    try {
      const historico = await checkHistoricoCriticoSolicitacao(id);
      console.log("[SOLIC_EQUIP][DELETE_HISTORICO]", historico);
      if (historico.temHistoricoCritico) {
        toast({
          title: "Não é possível excluir",
          description:
            "Esta solicitação já possui histórico operacional e não pode ser excluída. Use Cancelar.",
          variant: "destructive",
        });
        return false;
      }
    } catch (e: any) {
      console.warn("[SOLIC_EQUIP][DELETE_CHECK_ERROR]", e);
    }
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (e: any) {
      console.error("[SOLIC_EQUIP][DELETE_MUTATION_ERROR]", e);
      return false;
    }
  };

  const handleEditRequest = (s: SolicitacaoEquipamento) => {
    setEditingSolicitacao(s);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const resetFilters = () => setFilters({});

  // Resolve tipo por card, via descricao_padronizada normalizada
  const solicitacoesVisiveis = useMemo(
    () => (mostrarCanceladas ? solicitacoes : solicitacoes.filter((s) => String(s.status_fluxo) !== "CANCELADO")),
    [solicitacoes, mostrarCanceladas],
  );

  const cardsResolved = useMemo(() => {
    return CARDS.map((card) => {
      if (card.isOutros) return { ...card, tipo: null as null | { id: string; subcategoria_id?: string | null } };
      const tipo = tiposEquipamento.find((t: any) =>
        card.match.some((m) => norm(t.descricao_padronizada).includes(norm(m)))
      );
      return {
        ...card,
        tipo: tipo ? { id: tipo.id, subcategoria_id: (tipo as any).subcategoria_id ?? null } : null,
      };
    });
  }, [tiposEquipamento]);

  const handleCardClick = (card: (typeof cardsResolved)[number]) => {
    if (card.isOutros) {
      resetCategoriaSelection();
    } else {
      setSelectedTipoEquipamentoId(card.tipo?.id ?? null);
      setSelectedSubcategoriaId(card.tipo?.subcategoria_id ?? null);
      setSelectedCategoriaLabel(card.label);
      setSelectedCategoriaMatch(card.match);
    }
    setIsFormOpen(true);
  };

  const openNovaSolicitacao = () => {
    resetCategoriaSelection();
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {origemPlanejamentoMacro && (
        <OrigemPlanejamentoMacroBanner centroCustoId={centroCustoIdOrigem} />
      )}

      {/* Cards por tipo de equipamento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {cardsResolved.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => handleCardClick(card)}
              title={`Abrir solicitação: ${card.label}`}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border bg-card text-card-foreground",
                "hover:border-primary hover:shadow-sm transition-all text-center"
              )}
            >
              <Icon className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium leading-tight">{card.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Toggle Minhas / Todas */}
        <div className="inline-flex rounded-md border bg-card p-1">
          <button
            type="button"
            onClick={() => setApenasMinhas(true)}
            className={cn(
              "px-3 py-1.5 text-sm rounded",
              apenasMinhas ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Minhas Solicitações
          </button>
          {podeVerTodas && (
            <button
              type="button"
              onClick={() => setApenasMinhas(false)}
              className={cn(
                "px-3 py-1.5 text-sm rounded",
                !apenasMinhas ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todas
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground select-none">
            <Switch checked={mostrarCanceladas} onCheckedChange={setMostrarCanceladas} />
            Mostrar canceladas
          </label>
          <Button onClick={openNovaSolicitacao} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Nova Solicitação
          </Button>
        </div>
      </div>

      <SolicitacaoEquipamentoFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      <SolicitacaoEquipamentoTable
        solicitacoes={solicitacoesVisiveis}
        isLoading={isLoading}
        isError={isError}
        onView={(s) => setViewingSolicitacao(s)}
        onEdit={handleEditRequest}
        onDelete={handleDeleteRequest}
        userId={userId}
        isSuperAdmin={isSuperAdmin}
        permissions={permissions}
      />

      <SolicitacaoEquipamentoViewModal
        isOpen={!!viewingSolicitacao}
        onClose={() => setViewingSolicitacao(null)}
        solicitacao={viewingSolicitacao}
      />

      <SolicitacaoEquipamentoFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          resetCategoriaSelection();
        }}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
        initialCentroCustoId={centroCustoIdOrigem}
        initialOrigem={origemPlanejamentoMacro ? "planejamento_macro" : null}
        initialTipoEquipamentoId={selectedTipoEquipamentoId}
        initialSubcategoriaId={selectedSubcategoriaId}
        initialCategoriaLabel={selectedCategoriaLabel}
        initialCategoriaMatch={selectedCategoriaMatch}
        initialStep="itens"
      />

      {/* Modal de EDIÇÃO (cabeçalho apenas) */}
      <SolicitacaoEquipamentoFormModal
        isOpen={!!editingSolicitacao}
        onClose={() => setEditingSolicitacao(null)}
        onSubmit={handleCreate /* não usado em edit */}
        isSubmitting={false}
        mode="edit"
        initialData={editingSolicitacao}
        initialStep="dados"
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
          setEditingSolicitacao(null);
        }}
      />

      <SolicitacaoMatchingResultModal
        isOpen={isMatchingOpen}
        onClose={() => setIsMatchingOpen(false)}
        solicitacao={matchingResult}
      />

      {/* Approval/Rejection Modal */}
      <Dialog open={!!approvalItem} onOpenChange={(open) => { if (!open) { setApprovalItem(null); setApprovalComment(""); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Aprovar / Negar Solicitação</DialogTitle>
          </DialogHeader>
          {approvalItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Centro de Custo:</span> <strong>{approvalItem.codigo_centro_custo} - {approvalItem.nome_centro_custo}</strong></div>
                <div><span className="text-muted-foreground">Prioridade:</span> <strong>{approvalItem.prioridade}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Justificativa:</span> <strong>{approvalItem.justificativa}</strong></div>
                <div><span className="text-muted-foreground">Engenheiro:</span> <strong>{approvalItem.engenheiro_nome || "-"}</strong></div>
                <div><span className="text-muted-foreground">Apontador:</span> <strong>{approvalItem.apontador_nome || "-"}</strong></div>
                <div><span className="text-muted-foreground">Quantidade total:</span> <strong>{approvalItem.quantidade}</strong></div>
              </div>
              <div className="border rounded-md p-3 bg-muted/20">
                <div className="text-sm font-semibold mb-2">Itens ({approvalItem.itens?.length ?? 0})</div>
                {(!approvalItem.itens || approvalItem.itens.length === 0) ? (
                  <div className="text-sm text-muted-foreground">
                    {approvalItem.descricao_tipo_equipamento || "Sem itens detalhados."}
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {approvalItem.itens.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{formatItemDisplay(it)}</span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px]">Qtd: {it.quantidade}</Badge>
                          {isNaoCadastrado(it) && (
                            <Badge variant="destructive" className="text-[10px]">Não cadastrado</Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label>Comentário (opcional)</Label>
                <Textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Observação sobre a decisão..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleNegar} disabled={isApproving}>
              <XCircle className="mr-2 h-4 w-4" />
              Negar
            </Button>
            <Button onClick={handleAprovar} disabled={isApproving} className="text-white">
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SolicitacaoEquipamentoPage;
