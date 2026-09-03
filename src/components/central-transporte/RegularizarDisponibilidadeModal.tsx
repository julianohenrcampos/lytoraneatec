/**
 * CT-2 / G1 — Regularização assistida dentro da Central do Transporte.
 *
 * Delegação total ao fluxo único de disponibilidade: a escrita ocorre apenas
 * via `regularizarDisponibilidade` (RPC fn_ct_disponibilidade_upsert). Nenhuma
 * escrita direta em bd_disponibilidade_equipamentos, nenhum `id` no payload.
 */
import React from "react";
import DisponibilidadeAtivoModal from "@/components/disponibilidade/DisponibilidadeAtivoModal";

interface Props {
  open: boolean;
  onClose: () => void;
  equipamentoId: string;
  identificacao: string;
  situacaoCadastral?: string | null;
  possuiRegistro: boolean;
  centroCustoIdSugerido?: string | null;
  onSuccess?: () => void;
}

const RegularizarDisponibilidadeModal: React.FC<Props> = ({
  open,
  onClose,
  equipamentoId,
  identificacao,
  situacaoCadastral,
  centroCustoIdSugerido,
  onSuccess,
}) => (
  // `possuiRegistro` da análise é apenas um indicador: o modo CREATE/EDIT é
  // decidido pela leitura real do registro operacional (invalidarCachesAtivosOperacionais
  // roda no modal compartilhado após o sucesso).
  <DisponibilidadeAtivoModal
    open={open}
    onClose={onClose}
    equipamentoId={equipamentoId}
    identificacao={identificacao}
    situacaoCadastral={situacaoCadastral}
    centroCustoIdSugerido={centroCustoIdSugerido}
    onSuccess={onSuccess}
  />
);

export default RegularizarDisponibilidadeModal;
