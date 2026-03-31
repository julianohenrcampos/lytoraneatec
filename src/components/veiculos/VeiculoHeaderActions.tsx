
import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, FolderPlus, FileDown, FileUp, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadEquipamentoTemplate } from "@/services/veiculo/importExport";

interface VeiculoHeaderActionsProps {
  onNewClick: () => void;
  onExport: () => void;
  onImport: () => void;
  onManageCategorias: () => void;
  onManageSubcategorias: () => void;
  onManageFrotas: () => void;
  onManageLinhasOperacionais: () => void;
}

const VeiculoHeaderActions: React.FC<VeiculoHeaderActionsProps> = ({
  onNewClick,
  onExport,
  onImport,
  onManageCategorias,
  onManageSubcategorias,
  onManageFrotas,
  onManageLinhasOperacionais,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onNewClick} className="whitespace-nowrap">
        <Plus className="mr-2 h-4 w-4" />
        Novo C/E
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            <FolderPlus className="mr-2 h-4 w-4" />
            Cadastros
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={onManageCategorias}>Categoria</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageSubcategorias}>Subcategoria</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageFrotas}>Frota</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageLinhasOperacionais}>Linha Operacional</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            <FileDown className="mr-2 h-4 w-4" />
            Dados
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={() => downloadEquipamentoTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Modelo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImport}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default VeiculoHeaderActions;
