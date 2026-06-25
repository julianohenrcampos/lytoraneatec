import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SolicitacaoTransferenciaLoteDialog } from '@/components/desligamento/SolicitacaoTransferenciaLoteDialog';
import { SolicitacoesTransferenciaList } from '@/components/desligamento/solicitacoes/SolicitacoesTransferenciaList';
import { usePermission } from '@/hooks/usePermission';

const SolicitacoesTransferenciaSection: React.FC = () => {
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const fallback = (a: 'visualizar' | 'criar' | 'editar') =>
    hasActionPermission('gestao_rh_funcionarios_view', a);
  const canCreate =
    isSuperAdmin ||
    hasActionPermission('gestao_rh_solicitacoes_transferencia_view', 'criar') ||
    fallback('criar');
  const canEdit =
    isSuperAdmin ||
    hasActionPermission('gestao_rh_solicitacoes_transferencia_view', 'editar') ||
    fallback('editar');

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Crie solicitações de transferência individuais ou em lote. As solicitações ficam
          salvas no sistema e podem ser visualizadas ou reimpressas posteriormente.
        </p>
        <Button
          onClick={() => { setEditId(null); setOpen(true); }}
          disabled={!canCreate}
        >
          <Plus className="h-4 w-4 mr-2" /> Nova Solicitação de Transferência
        </Button>
      </div>
      <SolicitacoesTransferenciaList
        canCancel={canEdit}
        canDelete={canEdit}
        onOpen={(id) => { setEditId(id); setOpen(true); }}
      />
      <SolicitacaoTransferenciaLoteDialog
        open={open}
        solicitacaoId={editId}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditId(null); }}
      />
    </div>
  );
};

export default SolicitacoesTransferenciaSection;
