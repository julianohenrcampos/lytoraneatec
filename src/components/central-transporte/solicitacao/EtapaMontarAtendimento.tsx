/**
 * CT-9 — "1. MONTAR ATENDIMENTO": um único workspace No-Code / DnD.
 *
 * Composição pura de peças já existentes:
 *   - ATENDER (candidatos + itens alvo + modais CT-2) via `useAtenderVinculo`;
 *   - TRANSPORTE (canvas de viagens + recursos) via `EtapaMobilizacao`.
 *
 * Zero backend novo: reserva continua em `fn_ct_atendimento_atribuir` /
 * `fn_ct_atendimento_substituir`, rascunho em `fn_ct_mobilizacao_salvar_rascunho`
 * e programação em `fn_ct_mobilizacao_programar`.
 */
import React from "react";
import EtapaMobilizacao from "./EtapaMobilizacao";
import useAtenderVinculo from "./builder/useAtenderVinculo";

export const EtapaMontarAtendimento: React.FC = () => {
  const atender = useAtenderVinculo();

  return (
    <div className="space-y-3" data-testid="ct9-montar-atendimento">
      <EtapaMobilizacao
        tituloBuilder="Atendimento Builder"
        railCandidatos={atender.railCandidatos}
        canvasTopo={atender.itensStrip}
      />
      {atender.modais}
    </div>
  );
};

export default EtapaMontarAtendimento;
