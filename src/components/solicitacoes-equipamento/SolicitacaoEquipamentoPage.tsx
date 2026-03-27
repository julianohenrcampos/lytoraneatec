import React, { useState } from "react";
import { Settings2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSolicitacoesEquipamento, createSolicitacaoEquipamento, SolicitacaoEquipamentoInsert } from "@/services/solicitacaoEquipamentoService";
import SolicitacaoEquipamentoFilters from "./SolicitacaoEquipamentoFilters";
import SolicitacaoEquipamentoTable from "./SolicitacaoEquipamentoTable";
import SolicitacaoEquipamentoFormModal from "./SolicitacaoEquipamentoFormModal";
import SolicitacaoMatchingResultModal from "./SolicitacaoMatchingResultModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SolicitacaoEquipamentoPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [matchingResult, setMatchingResult] = useState<any>(null);
  const [isMatchingOpen, setIsMatchingOpen] = useState(false);
  const [filters, setFilters] = useState<{ status?: string; prioridade?: string; tipo_equipamento_id?: string }>({});

  const { data: solicitacoes = [], isLoading, isError } = useQuery({
    queryKey: ["solicitacoes-equipamento", filters],
    queryFn: () => fetchSolicitacoesEquipamento(filters),
  });

  const createMutation = useMutation({
    mutationFn: createSolicitacaoEquipamento,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
      toast({ title: "Solicitação criada", description: "A solicitação de equipamento foi registrada com sucesso." });
      setIsFormOpen(false);
      
      // Show matching result
      if (data.resultado_matching || data.sugestao_acao) {
        setMatchingResult(data);
        setIsMatchingOpen(true);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = async (data: SolicitacaoEquipamentoInsert) => {
    await createMutation.mutateAsync(data);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
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
    </div>
  );
};

export default SolicitacaoEquipamentoPage;
