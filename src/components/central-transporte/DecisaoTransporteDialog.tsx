import React, { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { registrarDecisaoTransporte, DecisaoTransporte, DECISAO_LABELS } from "@/services/centralTransporteService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  decisao: DecisaoTransporte;
  solicitacaoId: string;
  observacao: string;
  onClose: () => void;
  onSaved: () => void;
}

const DecisaoTransporteDialog: React.FC<Props> = ({ open, decisao, solicitacaoId, observacao, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      await registrarDecisaoTransporte({
        solicitacao_id: solicitacaoId,
        decisao,
        observacoes: observacao,
        usuario_transporte_id: user.id,
      });

      toast.success(`Decisão "${DECISAO_LABELS[decisao]}" registrada com sucesso.`);
      onSaved();
    } catch (err: any) {
      toast.error("Erro ao registrar decisão: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Decisão</AlertDialogTitle>
          <AlertDialogDescription>
            Registrar decisão: <strong>{DECISAO_LABELS[decisao]}</strong> para esta solicitação?
            {observacao && <p className="mt-2 text-xs">Observação: {observacao}</p>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DecisaoTransporteDialog;
