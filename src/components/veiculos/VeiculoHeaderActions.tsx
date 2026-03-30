
import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileUp, FolderPlus, Plus, Download } from "lucide-react";
import { downloadEquipamentoTemplate } from "@/services/veiculo/importExport";

interface VeiculoHeaderActionsProps {
  onNewClick: () => void;
  onExport: () => void;
  onImport: () => void;
  onManageCategorias: () => void;
  onManageSubcategorias: () => void;
  onManageFrotas: () => void;
}

const VeiculoHeaderActions: React.FC<VeiculoHeaderActionsProps> = ({
  onNewClick,
  onExport,
  onImport,
  onManageCategorias,
  onManageSubcategorias,
  onManageFrotas,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onNewClick} className="whitespace-nowrap">
        <Plus className="mr-2 h-4 w-4" />
        Novo C/E
      </Button>
      <Button variant="outline" onClick={onManageCategorias} className="whitespace-nowrap bg-[#0080ff] text-slate-50">
        <FolderPlus className="mr-2 h-4 w-4" />
        Categoria
      </Button>
      <Button variant="outline" onClick={onManageSubcategorias} className="whitespace-nowrap bg-[#0080ff] text-slate-50">
        <FolderPlus className="mr-2 h-4 w-4" />
        Subcategoria
      </Button>
      <Button variant="outline" onClick={onManageFrotas} className="whitespace-nowrap bg-[#0080ff] text-slate-50">
        <FolderPlus className="mr-2 h-4 w-4" />
        Frota
      </Button>
      <Button variant="outline" onClick={() => downloadEquipamentoTemplate()} className="whitespace-nowrap bg-[#0080ff] text-slate-50">
        <Download className="mr-2 h-4 w-4" />
        Baixar Modelo
      </Button>
      <Button variant="outline" onClick={onExport} className="whitespace-nowrap bg-[#0080ff] text-slate-50">
        <FileDown className="mr-2 h-4 w-4" />
        Exportar
      </Button>
      <Button variant="outline" onClick={onImport} className="whitespace-nowrap bg-[#0080ff] text-slate-50">
        <FileUp className="mr-2 h-4 w-4" />
        Importar
      </Button>
    </div>
  );
};

export default VeiculoHeaderActions;
