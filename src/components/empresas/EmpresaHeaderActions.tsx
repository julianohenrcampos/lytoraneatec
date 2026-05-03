
import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileUp, Plus } from "lucide-react";

interface EmpresaHeaderActionsProps {
  onNewEmpresa: () => void;
  onExport: () => void;
  onImport: () => void;
  canCreate?: boolean;
}

const EmpresaHeaderActions: React.FC<EmpresaHeaderActionsProps> = ({
  onNewEmpresa,
  onExport,
  onImport,
  canCreate = true,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {canCreate && (
        <Button onClick={onNewEmpresa} className="whitespace-nowrap">
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
      )}
      <Button variant="outline" onClick={onExport} className="whitespace-nowrap">
        <FileDown className="mr-2 h-4 w-4" />
        Exportar
      </Button>
      {canCreate && (
        <Button variant="outline" onClick={onImport} className="whitespace-nowrap">
          <FileUp className="mr-2 h-4 w-4" />
          Importar
        </Button>
      )}
    </div>
  );
};

export default EmpresaHeaderActions;
