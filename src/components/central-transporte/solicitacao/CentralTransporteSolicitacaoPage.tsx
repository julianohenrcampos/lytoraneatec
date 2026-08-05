/**
 * CT-3B — Página dedicada da solicitação na Central do Transporte.
 *
 * Substitui o modal extenso por um fluxo em etapas. Contratos CT-2/CT-2.2
 * intactos: a página apenas reorganiza a apresentação e a navegação.
 */
import React from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CentralTransporteSolicitacaoProvider,
  useCtSolicitacao,
} from "./CentralTransporteSolicitacaoProvider";
import CtSolicitacaoStepper from "./CtSolicitacaoStepper";
import EtapaItens from "./EtapaItens";
import EtapaMobilizacao from "./EtapaMobilizacao";
import EtapaRevisao from "./EtapaRevisao";
import EtapaSelecao from "./EtapaSelecao";
import SolicitacaoResumoHeader from "./SolicitacaoResumoHeader";


const Conteudo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    solicitacao,
    itens,
    isLoading,
    erro,
    resumoItens,
    etapa,
    irParaEtapa,
    ctOperation,
  } = useCtSolicitacao();

  const temTentativaIncerta = Array.from(ctOperation.attempts.values()).some(
    (a) => a.state === "UNCERTAIN",
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (erro || !solicitacao) {
    return (
      <Alert variant="destructive" data-testid="ct3b-erro-solicitacao">
        <AlertTitle className="text-sm">Solicitação não disponível</AlertTitle>
        <AlertDescription className="text-xs">
          Não foi possível carregar esta solicitação. Ela pode ter sido removida ou estar fora do
          seu escopo de acesso.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="ct3b-voltar"
          onClick={() =>
            navigate("/gestao-maquinas/central-transporte", { state: location.state })
          }
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à Central
        </Button>
      </div>

      {temTentativaIncerta && (
        <Alert data-testid="ct3b-alerta-incerto">
          <AlertTitle className="text-xs">Operação sem confirmação</AlertTitle>
          <AlertDescription className="text-xs">
            Existe uma operação sem confirmação. Repita exatamente a mesma operação — a chave de
            idempotência foi preservada e o registro não será duplicado.
          </AlertDescription>
        </Alert>
      )}

      <SolicitacaoResumoHeader
        solicitacao={solicitacao}
        resumoItens={resumoItens}
        totalItens={itens.length}
      />

      <CtSolicitacaoStepper atual={etapa} onSelect={irParaEtapa} />

      {etapa === "ITENS" && <EtapaItens />}
      {etapa === "SELECAO" && <EtapaSelecao />}
      {etapa === "MOBILIZACAO" && <EtapaMobilizacao />}
      {etapa === "REVISAO" && <EtapaRevisao />}
    </div>
  );
};


export const CentralTransporteSolicitacaoPage: React.FC = () => {
  const { solicitacaoId } = useParams<{ solicitacaoId: string }>();
  const [searchParams] = useSearchParams();
  const itemInicialId = searchParams.get("item");

  if (!solicitacaoId) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-xs">Solicitação não informada na URL.</AlertDescription>
      </Alert>
    );
  }

  return (
    <CentralTransporteSolicitacaoProvider
      solicitacaoId={solicitacaoId}
      itemInicialId={itemInicialId}
    >
      <Conteudo />
    </CentralTransporteSolicitacaoProvider>
  );
};

export default CentralTransporteSolicitacaoPage;
