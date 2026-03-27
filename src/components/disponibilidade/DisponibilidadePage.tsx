import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDisponibilidades, DisponibilidadeFilters } from "@/services/disponibilidadeEquipamentoService";
import DisponibilidadeTable from "./DisponibilidadeTable";
import DisponibilidadeFiltersBar from "./DisponibilidadeFilters";
import DisponibilidadeFormModal from "./DisponibilidadeFormModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { upsertDisponibilidade, DisponibilidadeEquipamento } from "@/services/disponibilidadeEquipamentoService";

const DisponibilidadePage: React.FC = () => {
  const [filters, setFilters] = useState<DisponibilidadeFilters>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DisponibilidadeEquipamento | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: disponibilidades = [], isLoading, isError } = useQuery({
    queryKey: ["disponibilidades", filters],
    queryFn: () => fetchDisponibilidades(filters),
  });

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      await upsertDisponibilidade(data);
      toast.success("Disponibilidade salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["disponibilidades"] });
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
          <h1 className="text-2xl font-bold tracking-tight">Disponibilidade Operacional</h1>
          <p className="text-muted-foreground">Gerencie o estado operacional dos equipamentos</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Registro
        </Button>
      </div>

      <DisponibilidadeFiltersBar filters={filters} onFiltersChange={setFilters} />
      <DisponibilidadeTable
        data={disponibilidades}
        isLoading={isLoading}
        isError={isError}
        onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
      />
      <DisponibilidadeFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        editingItem={editingItem}
      />
    </div>
  );
};

export default DisponibilidadePage;
