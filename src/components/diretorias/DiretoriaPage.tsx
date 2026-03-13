import React, { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchDiretorias, deleteDiretoria } from "@/services/diretoriaService";
import { useToast } from "@/hooks/use-toast";
import { Diretoria } from "@/types/diretoria";
import DiretoriaTable from "./DiretoriaTable";
import DiretoriaFormModal from "./DiretoriaFormModal";
import DeleteDiretoriaDialog from "./DeleteDiretoriaDialog";

const DiretoriaPage: React.FC = () => {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentDiretoria, setCurrentDiretoria] = useState<Diretoria | undefined>();
  const [deletingDiretoria, setDeletingDiretoria] = useState<Diretoria | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: diretorias, isLoading, isError, refetch } = useQuery({
    queryKey: ["diretorias"],
    queryFn: () => fetchDiretorias(),
  });

  const handleEdit = (d: Diretoria) => {
    setCurrentDiretoria(d);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setCurrentDiretoria(undefined);
    setIsFormOpen(true);
  };

  const handleConfirmDelete = (d: Diretoria) => {
    setDeletingDiretoria(d);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingDiretoria) return;
    try {
      setIsDeleting(true);
      await deleteDiretoria(deletingDiretoria.id);
      toast({ title: "Diretoria excluída", description: "Diretoria excluída com sucesso." });
      refetch();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao excluir diretoria.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-lg sm:text-2xl font-bold">Gestão de Diretorias</h1>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Diretoria
        </Button>
      </div>

      <DiretoriaTable
        diretorias={diretorias}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleEdit}
        onDelete={handleConfirmDelete}
      />

      <DiretoriaFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => refetch()}
        diretoria={currentDiretoria}
      />

      <DeleteDiretoriaDialog
        isOpen={isDeleteOpen}
        isDeleting={isDeleting}
        diretoria={deletingDiretoria}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default DiretoriaPage;
