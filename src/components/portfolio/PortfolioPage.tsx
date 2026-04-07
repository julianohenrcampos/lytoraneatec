import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolios, upsertPortfolio, bulkInsertPortfolios, PortfolioFilters, PortfolioEmpresa } from "@/services/portfolioEmpresaService";
import PortfolioTable from "./PortfolioTable";
import PortfolioFiltersBar from "./PortfolioFilters";
import PortfolioFormModal from "./PortfolioFormModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const PortfolioPage: React.FC = () => {
  const [filters, setFilters] = useState<PortfolioFilters>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioEmpresa | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["portfolios", filters],
    queryFn: () => fetchPortfolios(filters),
  });

  const handleBulkSubmit = async (empresa_id: string, items: any[]) => {
    setIsSubmitting(true);
    try {
      await bulkInsertPortfolios(empresa_id, items);
      toast.success(`${items.length} item(ns) salvo(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setIsModalOpen(false);
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error("Um ou mais itens já estão cadastrados para esta empresa.");
      } else {
        toast.error(e.message || "Erro ao salvar.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      await upsertPortfolio(formData);
      toast.success("Portfólio atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfólio de Empresas / Veic. e Equip.</h1>
          <p className="text-muted-foreground">Veículos e equipamentos que cada empresa pode fornecer</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Portfólio
        </Button>
      </div>

      <PortfolioFiltersBar filters={filters} onFiltersChange={setFilters} />
      <PortfolioTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
      />
      <PortfolioFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSubmitBulk={handleBulkSubmit}
        onSubmitEdit={handleEditSubmit}
        isSubmitting={isSubmitting}
        editingItem={editingItem}
      />
    </div>
  );
};

export default PortfolioPage;
