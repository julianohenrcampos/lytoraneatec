import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Truck, Building2 } from "lucide-react";
import { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: SolicitacaoEquipamento | null;
}

const matchingConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PROPRIO: { icon: <Truck className="h-6 w-6" />, className: "text-green-600 border-green-300 bg-green-50", label: "Frota Própria" },
  GRUPO: { icon: <Building2 className="h-6 w-6" />, className: "text-blue-600 border-blue-300 bg-blue-50", label: "Grupo Empresarial" },
  FORNECEDOR: { icon: <Building2 className="h-6 w-6" />, className: "text-orange-600 border-orange-300 bg-orange-50", label: "Fornecedor Externo" },
  NAO_ENCONTRADO: { icon: <AlertTriangle className="h-6 w-6" />, className: "text-red-600 border-red-300 bg-red-50", label: "Não Encontrado" },
};

const SolicitacaoMatchingResultModal: React.FC<Props> = ({ isOpen, onClose, solicitacao }) => {
  if (!solicitacao) return null;

  const matching = solicitacao.resultado_matching ? matchingConfig[solicitacao.resultado_matching] : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Resultado do Matching
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo da solicitação */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Tipo Solicitado</p>
              <p className="font-medium">{solicitacao.descricao_tipo_equipamento || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Quantidade</p>
              <p className="font-medium">{solicitacao.quantidade}</p>
            </div>
          </div>

          {/* Resultado */}
          {matching ? (
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${matching.className}`}>
              {matching.icon}
              <div>
                <p className="font-semibold text-lg">{matching.label}</p>
                {solicitacao.quantidade_disponivel_encontrada != null && (
                  <p className="text-sm opacity-80">
                    {solicitacao.quantidade_disponivel_encontrada} unidade(s) disponível(is)
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum resultado de matching disponível.</p>
          )}

          {solicitacao.sugestao_acao && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-1">Sugestão de Ação</p>
              <p className="text-sm">{solicitacao.sugestao_acao}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SolicitacaoMatchingResultModal;
