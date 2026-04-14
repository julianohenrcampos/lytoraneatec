import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getFrotas, Frota } from "@/services/frotaService";
import FrotaTable from "./FrotaTable";
import FrotaFormModal from "./FrotaFormModal";
import FrotaFilters from "./FrotaFilters";
import { Button } from "@/components/ui/button";


const FrotaPage: React.FC = () => {
  const [filters, setFilters] = useState<{ codigo?: string; tipo?: string; ativo?: string }>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFrota, setEditingFrota] = useState<Frota | undefined>();

  const { data: frotas, isLoading, isError, refetch } = useQuery({
    queryKey: ['frotas', filters],
    queryFn: () => getFrotas(filters),
  });

  const handleEdit = (frota: Frota) => {
    setEditingFrota(frota);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setEditingFrota(undefined);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Frota
        </Button>
      </div>

      <FrotaFilters
        filters={filters}
        onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        onReset={() => setFilters({})}
      />

      <FrotaTable
        frotas={frotas}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleEdit}
      />

      <FrotaFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => refetch()}
        frota={editingFrota}
      />
    </div>
  );
};

export default FrotaPage;
