import { useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import FluxoTable from "@/components/fluxo/FluxoTable";
import FluxoEditor from "@/components/fluxo/FluxoEditor";
import { useFluxos, useDeleteFluxo, useDuplicarFluxo } from "@/hooks/useFluxoConfig";
import type { FluxoAprovacao } from "@/types/fluxoAprovacao";

export default function GestaoFluxos() {
  usePageTitle("Gestão de Fluxos de Aprovação");
  const { data: fluxos = [], isLoading } = useFluxos();
  const deleteFluxo = useDeleteFluxo();
  const duplicarFluxo = useDuplicarFluxo();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFluxo, setEditingFluxo] = useState<FluxoAprovacao | null>(null);

  const handleNew = () => {
    setEditingFluxo(null);
    setEditorOpen(true);
  };

  const handleEdit = (fluxo: FluxoAprovacao) => {
    setEditingFluxo(fluxo);
    setEditorOpen(true);
  };

  const handleClose = () => {
    setEditorOpen(false);
    setEditingFluxo(null);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div></div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
          </Button>
        </div>

        <FluxoTable
          fluxos={fluxos}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDuplicate={(id) => duplicarFluxo.mutate(id)}
          onDelete={(id) => deleteFluxo.mutate(id)}
          isDuplicating={duplicarFluxo.isPending}
          isDeleting={deleteFluxo.isPending}
        />

        <FluxoEditor
          open={editorOpen}
          onClose={handleClose}
          fluxo={editingFluxo}
        />
      </div>
    </MainLayout>
  );
}
