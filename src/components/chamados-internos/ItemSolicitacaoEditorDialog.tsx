import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ItemBuilderSubForm from "@/components/solicitacoes-equipamento/ItemBuilderSubForm";
import type { SolicitacaoItemInsert } from "@/services/solicitacaoItensService";

export type ItemComDisplay = SolicitacaoItemInsert & { _displayName?: string };

interface Props {
  open: boolean;
  editingItem: ItemComDisplay | null;
  onClose: () => void;
  onSave: (item: ItemComDisplay) => void;
}

/**
 * Hospeda o MESMO `ItemBuilderSubForm` (inclusão e edição) em um Dialog com
 * scroll interno, evitando que o formulário de item ocupe a área vertical do
 * wizard. Nenhuma regra de item é duplicada aqui.
 */
const ItemSolicitacaoEditorDialog: React.FC<Props> = ({
  open,
  editingItem,
  onClose,
  onSave,
}) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>{editingItem ? "Editar item" : "Adicionar item"}</DialogTitle>
        <DialogDescription>
          Informe o tipo, a subcategoria e as condições operacionais do item.
        </DialogDescription>
      </DialogHeader>
      {open && (
        <ItemBuilderSubForm
          onAdd={onSave}
          onCancel={onClose}
          editingItem={editingItem}
        />
      )}
    </DialogContent>
  </Dialog>
);

export default ItemSolicitacaoEditorDialog;
