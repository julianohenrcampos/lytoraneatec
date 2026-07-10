import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";
import { useSolicitacaoMatching } from "@/hooks/useSolicitacaoMatching";
import type { ItemMatchResult, MatchClassification } from "@/utils/solicitacaoMatching";
import { formatItemDisplay, isNaoCadastrado } from "@/utils/solicitacaoItemDisplay";
import { formatDateBR } from "@/utils/formatDateBR";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: SolicitacaoEquipamento | null;
}

const CFG: Record<MatchClassification, { className: string; label: string; Icon: React.ComponentType<any> }> = {
  disponivel_total:       { className: "text-green-700 border-green-300 bg-green-50",    label: "Disponível",                    Icon: CheckCircle2 },
  disponivel_parcial:     { className: "text-amber-700 border-amber-300 bg-amber-50",    label: "Disponibilidade parcial",       Icon: AlertTriangle },
  existente_indisponivel: { className: "text-orange-700 border-orange-300 bg-orange-50", label: "Existente sem disponibilidade", Icon: AlertCircle },
  nao_encontrado:         { className: "text-red-700 border-red-300 bg-red-50",          label: "Não encontrado no cadastro",    Icon: XCircle },
  sem_classificacao:      { className: "text-gray-700 border-gray-300 bg-gray-50",       label: "Sem classificação",             Icon: HelpCircle },
};

const CountsRow: React.FC<{ result: ItemMatchResult }> = ({ result }) => {
  const c = result.counts;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <Badge variant="outline" className="text-[10px]">Existentes: {c.existentes}</Badge>
      <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">Disponíveis: {c.disponiveis}</Badge>
      <Badge variant="outline" className="text-[10px]">Operando/Alocados: {c.operandoAlocados}</Badge>
      <Badge variant="outline" className="text-[10px]">Manutenção: {c.manutencao}</Badge>
      <Badge variant="outline" className="text-[10px]">Indisponíveis: {c.indisponiveis}</Badge>
      <Badge variant="outline" className="text-[10px]">Sem status: {c.semStatus}</Badge>
    </div>
  );
};

const SolicitacaoMatchingResultModal: React.FC<Props> = ({ isOpen, onClose, solicitacao }) => {
  const { isLoading, results } = useSolicitacaoMatching(solicitacao);
  if (!solicitacao) return null;

  console.log("[SOLIC_EQUIP][MATCHING_MODAL_DATA]", {
    solicitacao_id: (solicitacao as any)?.id,
    itens_count: solicitacao.itens?.length ?? 0,
    itens_resumo: (solicitacao as any)?.itens_resumo ?? null,
  });

  const itensResumo = (solicitacao as any)?.itens_resumo as string | null | undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análise de Disponibilidade</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm border rounded-md p-3 bg-muted/20">
            <div>
              <p className="text-muted-foreground">Data de Início</p>
              <p className="font-medium">{formatDateBR(solicitacao.data_inicio)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Itens</p>
              <p className="font-medium">{solicitacao.itens?.length ?? 0}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Centro de Custo</p>
              <p className="font-medium">
                {solicitacao.codigo_centro_custo ? `${solicitacao.codigo_centro_custo} — ` : ""}
                {solicitacao.nome_centro_custo || "-"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Analisando inventário...
            </div>
          ) : results.length === 0 ? (
            itensResumo ? (
              <div className="text-sm border rounded-md p-3 bg-muted/10">
                <p className="text-muted-foreground mb-1">Tipo Solicitado</p>
                <p className="font-medium">{itensResumo}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum item para analisar.</p>
            )
          ) : (
            <div className="space-y-2">
              {results.map((r) => {
                const cfg = CFG[r.classification];
                const Icon = cfg.Icon;
                return (
                  <div key={r.item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.className}`}>
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{formatItemDisplay(r.item)}</span>
                        <Badge variant="outline" className="text-[10px]">Qtd: {r.item.quantidade}</Badge>
                        {isNaoCadastrado(r.item) && (
                          <Badge variant="destructive" className="text-[10px]">Não cadastrado</Badge>
                        )}
                        <Badge className="text-[10px]" variant="secondary">{cfg.label}</Badge>
                      </div>
                      <p className="text-sm mt-1">{r.message}</p>
                      <CountsRow result={r} />
                    </div>
                  </div>
                );
              })}
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
