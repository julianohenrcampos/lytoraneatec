/**
 * Confirmação de seleção de ativo de departamento diferente do direcionamento
 * preferencial da solicitação.
 *
 * REGRAS:
 *  - permitir sempre (RBAC/escopo continuam sendo decididos pelo servidor);
 *  - exigir justificativa própria DAQUELE ativo (mínimo 10 caracteres);
 *  - NUNCA alterar o direcionamento geral da solicitação (isso é feito apenas
 *    pela RPC fn_solic_equip_alterar_atendimento_preferencial, sob ação
 *    explícita do planejador).
 */
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { registrarAtivoDepartamentoAlternativo } from "@/services/centralTransporteDepartamentoService";

export const JUSTIFICATIVA_MIN = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  solicitacaoId: string;
  equipamentoId: string;
  identificacao: string;
  departamentoAtivoNome: string | null;
  departamentoPreferencialNome: string | null;
  /** Confirmação registrada — a seleção contextual segue no chamador. */
  onConfirmado: () => void;
}

const DepartamentoAlternativoDialog: React.FC<Props> = ({
  open,
  onClose,
  solicitacaoId,
  equipamentoId,
  identificacao,
  departamentoAtivoNome,
  departamentoPreferencialNome,
  onConfirmado,
}) => {
  const { toast } = useToast();
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valido = justificativa.trim().length >= JUSTIFICATIVA_MIN;

  const confirmar = async () => {
    if (!valido) return;
    setSubmitting(true);
    try {
      await registrarAtivoDepartamentoAlternativo(solicitacaoId, equipamentoId, justificativa.trim());
      toast({ title: "Seleção registrada", description: "Justificativa registrada na timeline do chamado." });
      setJustificativa("");
      onConfirmado();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível registrar",
        description: (err as { message?: string })?.message ?? "Falha ao registrar a justificativa.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="ct5-dialog-departamento-alternativo">
        <DialogHeader>
          <DialogTitle className="text-base">Ativo de outro departamento</DialogTitle>
          <DialogDescription className="text-xs">
            O ativo <strong>{identificacao}</strong> pertence ao Departamento{" "}
            <strong>{departamentoAtivoNome || "não informado"}</strong>, diferente do direcionamento
            preferencial <strong>{departamentoPreferencialNome || "Avaliar disponibilidade"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Alert className="py-2">
          <AlertDescription className="text-xs">
            O direcionamento preferencial da solicitação NÃO será alterado. Esta justificativa vale
            apenas para este atendimento.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="just-dep-alt" className="text-xs">
            Justificativa * (mínimo {JUSTIFICATIVA_MIN} caracteres)
          </Label>
          <Textarea
            id="just-dep-alt"
            rows={3}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            data-testid="ct5-just-departamento-alternativo"
            placeholder="Explique por que o atendimento usará um ativo de outro departamento."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!valido || submitting}
            data-testid="ct5-confirmar-departamento-alternativo"
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartamentoAlternativoDialog;
