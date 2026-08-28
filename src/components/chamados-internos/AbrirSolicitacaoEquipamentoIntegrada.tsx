import React from "react";
import { toast } from "sonner";
import SolicitacaoEquipamentoFormModal from "@/components/solicitacoes-equipamento/SolicitacaoEquipamentoFormModal";
import type { SolicitacaoEquipamentoInsert } from "@/services/solicitacaoEquipamentoService";
import type { SolicitacaoItemInsert } from "@/services/solicitacaoItensService";
import { abrirChamadoComSolicitacaoEquipamento } from "@/services/chamadoOperacionalService";

export interface ChamadoIntegradoContexto {
  centro_custo_id: string;
  categoria_id: string;
  solicitante_funcionario_id: string;
  titulo: string;
  descricao: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  chamado: ChamadoIntegradoContexto;
  onSuccess: (chamadoId: string, protocolo: string) => void;
}

/**
 * Fluxo integrado CHI → Solicitação de Equipamento.
 * Reutiliza o MESMO wizard do fluxo antigo (nenhuma regra duplicada): apenas o
 * submit é injetado, apontando para a RPC transacional que abre CHI + SOL juntos.
 */
const AbrirSolicitacaoEquipamentoIntegrada: React.FC<Props> = ({
  isOpen,
  onClose,
  chamado,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (
    data: SolicitacaoEquipamentoInsert,
    itens: SolicitacaoItemInsert[],
  ) => {
    setIsSubmitting(true);
    try {
      const solicitacaoId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;

      const res = await abrirChamadoComSolicitacaoEquipamento({
        ...chamado,
        solicitacao_id: solicitacaoId,
        tipo_equipamento_id: data.tipo_equipamento_id ?? null,
        data_inicio: data.data_inicio,
        tempo_previsto_dias: data.tempo_previsto_dias ?? null,
        regime_trabalho: data.regime_trabalho ?? null,
        com_operador: Boolean(data.com_operador),
        prioridade: data.prioridade ?? "NORMAL",
        justificativa: data.justificativa,
        engenheiro_solicitante_id: data.engenheiro_solicitante_id as string,
        apontador_responsavel_id: data.apontador_responsavel_id as string,
        departamento_atendimento_preferencial_id:
          data.departamento_atendimento_preferencial_id ?? null,
        itens,
      });

      toast.success("Chamado e solicitação criados", {
        description: `${res.protocolo} · ${res.referencia_tecnica}`,
      });
      onSuccess(res.chamado_id, res.protocolo);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("CHAMADOS_ACOES_INTEGRADAS_DESATIVADAS")) {
        toast.error("Fluxo integrado indisponível", {
          description:
            "Esta funcionalidade está em piloto controlado e não está liberada para o seu usuário.",
        });
        onClose();
        return;
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }

  };

  return (
    <SolicitacaoEquipamentoFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      initialCentroCustoId={chamado.centro_custo_id}
    />
  );
};

export default AbrirSolicitacaoEquipamentoIntegrada;
