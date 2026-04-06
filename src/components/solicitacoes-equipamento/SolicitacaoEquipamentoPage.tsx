import React, { useState } from "react";
import { Settings2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSolicitacoesEquipamento,
  createSolicitacaoEquipamento,
  aprovarSolicitacaoEquipamento,
  negarSolicitacaoEquipamento,
  SolicitacaoEquipamentoInsert,
  SolicitacaoEquipamento,
} from "@/services/solicitacaoEquipamentoService";
import { insertItensSolicitacao, SolicitacaoItemInsert } from "@/services/solicitacaoItensService";
import SolicitacaoEquipamentoFilters from "./SolicitacaoEquipamentoFilters";
import SolicitacaoEquipamentoTable from "./SolicitacaoEquipamentoTable";
import SolicitacaoEquipamentoFormModal from "./SolicitacaoEquipamentoFormModal";
import SolicitacaoMatchingResultModal from "./SolicitacaoMatchingResultModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SolicitacaoEquipamentoPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [matchingResult, setMatchingResult] = useState<any>(null);
  const [isMatchingOpen, setIsMatchingOpen] = useState(false);
  const [filters, setFilters] = useState<{ status?: string; prioridade?: string; tipo_equipamento_id?: string; status_fluxo?: string }>({});

  // Approval modal state
  const [approvalItem, setApprovalItem] = useState<SolicitacaoEquipamento | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const { data: solicitacoes = [], isLoading, isError } = useQuery({
    queryKey: ["solicitacoes-equipamento", filters],
    queryFn: () => fetchSolicitacoesEquipamento(filters),
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, itens }: { data: SolicitacaoEquipamentoInsert; itens: SolicitacaoItemInsert[] }) => {
      const result = await createSolicitacaoEquipamento(data);
      if (itens.length > 0) {
        await insertItensSolicitacao(result.id, itens);
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
      toast({ title: "Solicitação criada", description: "A solicitação de equipamento foi registrada com sucesso." });
      setIsFormOpen(false);
      if (data.resultado_matching || data.sugestao_acao) {
        setMatchingResult(data);
        setIsMatchingOpen(true);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = async (data: SolicitacaoEquipamentoInsert, itens: SolicitacaoItemInsert[]) => {
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const resetFilters = () => setFilters({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Solicitações de Equipamento</h1>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="text-white">
          <Plus className="mr-2 h-4 w-4" />
          Nova Solicitação
        </Button>
      </div>

      <SolicitacaoEquipamentoFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      <SolicitacaoEquipamentoTable
        solicitacoes={solicitacoes}
        isLoading={isLoading}
        isError={isError}
        onSelectForApproval={(s) => setApprovalItem(s)}
      />

      <SolicitacaoEquipamentoFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
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
                <div><span className="text-muted-foreground">Equipamento:</span> <strong>{approvalItem.descricao_tipo_equipamento}</strong></div>
                <div><span className="text-muted-foreground">Quantidade:</span> <strong>{approvalItem.quantidade}</strong></div>
                <div><span className="text-muted-foreground">Centro de Custo:</span> <strong>{approvalItem.codigo_centro_custo} - {approvalItem.nome_centro_custo}</strong></div>
                <div><span className="text-muted-foreground">Prioridade:</span> <strong>{approvalItem.prioridade}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Justificativa:</span> <strong>{approvalItem.justificativa}</strong></div>
                <div><span className="text-muted-foreground">Engenheiro:</span> <strong>{approvalItem.engenheiro_nome || "-"}</strong></div>
                <div><span className="text-muted-foreground">Apontador:</span> <strong>{approvalItem.apontador_nome || "-"}</strong></div>
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
