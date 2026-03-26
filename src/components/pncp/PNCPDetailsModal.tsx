import { PNCPContratacao } from "@/types/pncp";
import { formatCurrency, formatDate, formatDateTime } from "@/services/pncpService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Building2, MapPin, Calendar, DollarSign, FileText, Tag, XCircle, RotateCcw, Clock, CheckCircle, Brain, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getScoreLabel, DICIONARIO_SINONIMOS, calcularSmartMatch } from "@/utils/smartMatching";

interface PNCPDetailsModalProps {
  contratacao: PNCPContratacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleDescartada?: (id: string, descartada: boolean) => void;
}

export function PNCPDetailsModal({ contratacao, open, onOpenChange, onToggleDescartada }: PNCPDetailsModalProps) {
  if (!contratacao) return null;

  const isPrazoEncerrado = contratacao.data_fim_propostas 
    ? new Date(contratacao.data_fim_propostas) < new Date() 
    : false;

  const getPrioridadeBadge = (prioridade: string | null) => {
    switch (prioridade) {
      case "alta":
        return <Badge variant="destructive">Alta Prioridade</Badge>;
      case "media":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Média Prioridade</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes da Licitação
          </DialogTitle>
          <DialogDescription>
            {contratacao.numero_controle_pncp}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Objeto */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Objeto</h4>
            <p className="text-sm">{contratacao.objeto}</p>
          </div>

          <Separator />

          {/* Órgão Interno (Normalizado) */}
          {contratacao.orgao_id && contratacao.orgao_sigla ? (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                Órgão Classificado
              </h4>
              <Badge className="bg-blue-600 text-white mb-1">{contratacao.orgao_sigla}</Badge>
              <p className="text-sm text-blue-600 dark:text-blue-400">{contratacao.orgao_nome}</p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Órgão pendente de classificação
              </h4>
            </div>
          )}

          <Separator />

          {/* Órgão e Unidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Órgão (API)</h4>
                <p className="text-sm font-medium">{contratacao.orgao_nome || "N/A"}</p>
                {contratacao.orgao_cnpj && (
                  <p className="text-xs text-muted-foreground">CNPJ: {contratacao.orgao_cnpj}</p>
                )}
              </div>
            </div>

            {contratacao.unidade_nome && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Unidade</h4>
                <p className="text-sm">{contratacao.unidade_nome}</p>
              </div>
            )}
          </div>

          {/* Local */}
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Localização</h4>
              <p className="text-sm">
                {contratacao.municipio_nome || "N/A"} / {contratacao.uf || "N/A"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Valor e Modalidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-primary mt-1" />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Valor Estimado</h4>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(contratacao.valor_total_estimado)}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Modalidade</h4>
              {contratacao.modalidade_contratacao ? (
                <Badge variant="outline" className="mt-1">
                  {contratacao.modalidade_contratacao}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">N/A</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Datas */}
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Publicação</h4>
                <p className="text-sm">{formatDate(contratacao.data_publicacao)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Início Propostas</h4>
                <p className="text-sm">{formatDate(contratacao.data_inicio_propostas)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Fim Propostas</h4>
                <p className="text-sm font-medium">{formatDate(contratacao.data_fim_propostas)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Prioridade, Termos e Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Prioridade</h4>
              {getPrioridadeBadge(contratacao.prioridade)}
            </div>

            {contratacao.match_termos && contratacao.match_termos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Termos Encontrados
                </h4>
                <div className="flex flex-wrap gap-1">
                  {contratacao.match_termos.map((termo, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {termo}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Brain className="h-3 w-3" />
                Score de Relevância (Auditoria)
              </h4>
              {(() => {
                const score = contratacao.score_busca || 0;
                const { label, variant } = getScoreLabel(score);
                const grupos = contratacao.grupos_match || [];
                
                // Recalculate to show breakdown
                const audit = calcularSmartMatch(
                  contratacao.objeto || '',
                  contratacao.orgao_sigla,
                  contratacao.valor_total_estimado
                );

                return (
                  <div className="space-y-2">
                    <Badge variant={variant} className="flex items-center gap-1 w-fit">
                      <Brain className="h-3 w-3" />
                      {score} pts — {label}
                    </Badge>
                    
                    {/* Breakdown */}
                    <div className="text-xs space-y-0.5 bg-muted/30 rounded p-2">
                      <p className="font-medium text-muted-foreground flex items-center gap-1 mb-1">
                        <Info className="h-3 w-3" /> Detalhamento do score:
                      </p>
                      {audit.motivos.length > 0 ? (
                        audit.motivos.map((motivo, i) => (
                          <p key={i} className="text-foreground">{motivo}</p>
                        ))
                      ) : (
                        <p className="text-muted-foreground italic">Nenhuma regra ativada</p>
                      )}
                    </div>

                    {audit.gruposNomes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {audit.gruposNomes.map((nome, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {nome}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Auditoria de Classificação */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Dados de Importação / Auditoria
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Órgão (API):</span>
                <p className="font-medium">{contratacao.orgao_nome || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sigla Interna:</span>
                <p className="font-medium">{contratacao.orgao_sigla || "Não classificado"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">CNPJ Órgão:</span>
                <p className="font-medium">{contratacao.orgao_cnpj || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Unidade (API):</span>
                <p className="font-medium">{contratacao.unidade_nome || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Importado em:</span>
                <p className="font-medium">{formatDateTime(contratacao.created_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status Classificação:</span>
                <p className="font-medium">
                  {contratacao.orgao_id ? (
                    <Badge variant="success" className="text-xs">Classificado</Badge>
                  ) : contratacao.orgao_nome ? (
                    <Badge variant="warning" className="text-xs">Pendente</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Sem órgão</Badge>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Metadados */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <p>Criado em: {formatDateTime(contratacao.created_at)}</p>
            {contratacao.updated_at !== contratacao.created_at && (
              <p>Atualizado em: {formatDateTime(contratacao.updated_at)}</p>
            )}
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex flex-col gap-2">
            {isPrazoEncerrado ? (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 w-fit">
                <Clock className="h-3 w-3 mr-1" />
                Prazo Encerrado
              </Badge>
            ) : contratacao.descartada ? (
              <Button
                variant="outline"
                className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50"
                onClick={() => {
                  onToggleDescartada?.(contratacao.id, false);
                  onOpenChange(false);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reativar Licitação
              </Button>
            ) : contratacao.participando ? (
              <Badge className="bg-green-100 text-green-700 w-fit">
                <CheckCircle className="h-3 w-3 mr-1" />
                Participando desta Licitação
              </Badge>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  onToggleDescartada?.(contratacao.id, true);
                  onOpenChange(false);
                }}
              >
                <XCircle className="h-4 w-4" />
                Descartar (sem interesse)
              </Button>
            )}
          </div>

          {/* Botão externo */}
          {contratacao.link_origem_pncp && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(contratacao.link_origem_pncp!, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir no Portal PNCP
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
