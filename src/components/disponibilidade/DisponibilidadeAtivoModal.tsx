/**
 * Wrapper que resolve CREATE × EDIT a partir do REGISTRO REAL do ativo.
 *
 * Nunca abre CREATE por suposição: se o indicador diz que existe registro mas a
 * leitura falha, exibe erro de carregamento com opção de tentar novamente.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { fetchEstadoOperacionalAtivo } from "@/services/disponibilidadeEquipamentoService";
import DisponibilidadeUpsertModal from "./DisponibilidadeUpsertModal";

interface Props {
  open: boolean;
  onClose: () => void;
  equipamentoId: string;
  identificacao: string;
  situacaoCadastral?: string | null;
  centroCustoIdSugerido?: string | null;
  onSuccess?: () => void;
}

const DisponibilidadeAtivoModal: React.FC<Props> = ({
  open,
  onClose,
  equipamentoId,
  identificacao,
  situacaoCadastral,
  centroCustoIdSugerido,
  onSuccess,
}) => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["estado-operacional-ativo", equipamentoId],
    queryFn: () => fetchEstadoOperacionalAtivo(equipamentoId),
    enabled: open && !!equipamentoId,
    retry: false,
  });

  if (isLoading || isError || !data) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disponibilidade operacional — {identificacao}</DialogTitle>
          </DialogHeader>
          {isError ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar o registro operacional deste ativo. Tente novamente antes de
              alterar o status.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando registro operacional…
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {isError && (
              <Button onClick={() => refetch()} disabled={isFetching}>
                Tentar novamente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const modo = data.possuiRegistroDisponibilidade && data.registro ? "EDIT" : "CREATE";

  return (
    <DisponibilidadeUpsertModal
      open={open}
      onClose={onClose}
      modo={modo}
      equipamentoId={equipamentoId}
      identificacao={identificacao}
      situacaoCadastral={situacaoCadastral}
      registroAtual={modo === "EDIT" ? data.registro : null}
      centroCustoIdSugerido={centroCustoIdSugerido}
      onSuccess={onSuccess}
    />
  );
};

export default DisponibilidadeAtivoModal;
