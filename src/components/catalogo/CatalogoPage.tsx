import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCatalogos, upsertCatalogo, CatalogoFilters, CatalogoEquipamento } from "@/services/catalogoEquipamentoService";
import CatalogoTable from "./CatalogoTable";
import CatalogoFiltersBar from "./CatalogoFilters";
import CatalogoFormModal from "./CatalogoFormModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const CatalogoPage: React.FC = () => {
  const [filters, setFilters] = useState<CatalogoFilters>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoEquipamento | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["catalogos", filters],
    queryFn: () => fetchCatalogos(filters),
  });

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      await upsertCatalogo(formData);
      toast.success("Item do catálogo salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["catalogos"] });
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
          <h1 className="text-2xl font-bold tracking-tight">Catálogo Técnico de Equipamentos</h1>
          <p className="text-muted-foreground">Templates técnicos reutilizáveis para portfólio e pré-cadastro</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Item
        </Button>
      </div>

      <CatalogoFiltersBar filters={filters} onFiltersChange={setFilters} />
      <CatalogoTable data={data} isLoading={isLoading} isError={isError} onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }} />
      <CatalogoFormModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSubmit={handleSubmit} isSubmitting={isSubmitting} editingItem={editingItem} />
    </div>
  );
};

export default CatalogoPage;
