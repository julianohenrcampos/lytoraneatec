import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolios, upsertPortfolio, PortfolioFilters, PortfolioEmpresa } from "@/services/portfolioEmpresaService";
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

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      await upsertPortfolio(formData);
      toast.success("Portfólio salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error("Este tipo de equipamento já está cadastrado para esta empresa.");
      } else {
        toast.error(e.message || "Erro ao salvar.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfólio de Empresas</h1>
          <p className="text-muted-foreground">Tipos de equipamentos que cada empresa pode fornecer</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Portfólio
        </Button>
      </div>

      <PortfolioFiltersBar filters={filters} onFiltersChange={setFilters} />
      <PortfolioTable data={data} isLoading={isLoading} isError={isError} onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }} />
      <PortfolioFormModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSubmit={handleSubmit} isSubmitting={isSubmitting} editingItem={editingItem} />
    </div>
  );
};

export default PortfolioPage;
