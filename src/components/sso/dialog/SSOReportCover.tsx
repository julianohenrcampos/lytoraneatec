import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { SSOChecklist } from '@/types/sso';
import { FileText, Calendar, Users, ClipboardCheck } from 'lucide-react';

interface SSOReportCoverProps {
  checklist: SSOChecklist;
  naoConformidadesCount: number;
}

export const SSOReportCover = ({ checklist, naoConformidadesCount }: SSOReportCoverProps) => {
  const conformidadePercentual = checklist.total_aplicaveis 
    ? Math.round((checklist.total_conformes! / checklist.total_aplicaveis) * 100) 
    : 0;

  return (
    <div className="space-y-8 break-inside-avoid">
      {/* Cabeçalho Principal */}
      <div className="text-center space-y-4 pb-6 border-b-2 border-primary">
        <div className="flex justify-center">
          <FileText className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">
          RELATÓRIO DE NÃO CONFORMIDADES
        </h1>
        <p className="text-xl font-semibold text-muted-foreground">
          SSO - NR-18
        </p>
        <p className="text-lg text-muted-foreground">
          {format(new Date(checklist.data_inspecao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Informações da Obra */}
      <div className="bg-muted/30 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Informações da Inspeção
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Obra:</p>
            <p className="text-base font-semibold text-foreground">
              {checklist.bd_centros_custo?.nome_centro_custo}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Código:</p>
            <p className="text-base font-semibold text-foreground">
              {checklist.bd_centros_custo?.codigo_centro_custo}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            Equipe Responsável
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Gerente Regional:</span>
              <span className="text-sm font-medium text-foreground">{checklist.gerente_regional}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Engenheiro da Obra:</span>
              <span className="text-sm font-medium text-foreground">{checklist.engenheiro_obra}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Técnico de Segurança:</span>
              <span className="text-sm font-medium text-foreground">{checklist.tecnico_seguranca}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo Executivo */}
      <div className="bg-card rounded-lg border-2 border-border p-6 space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Resumo Executivo
        </h2>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Resultado</p>
            <Badge 
              variant={
                checklist.resultado_avaliacao === 'Crítico' ? 'destructive' :
                checklist.resultado_avaliacao === 'Em Atenção' ? 'secondary' :
                'default'
              }
              className="text-sm font-bold"
            >
              {checklist.resultado_avaliacao}
            </Badge>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Nota Real</p>
            <p className="text-2xl font-bold text-foreground">
              {checklist.nota_real?.toFixed(1)}
            </p>
          </div>

          <div className="text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">Não Conformidades</p>
            <p className="text-2xl font-bold text-destructive">
              {naoConformidadesCount}
            </p>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Conformidade</p>
            <p className="text-2xl font-bold text-foreground">
              {conformidadePercentual}%
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total de Itens Avaliados:</span>
            <span className="font-semibold text-foreground">{checklist.total_aplicaveis}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted-foreground">Itens Conformes:</span>
            <span className="font-semibold text-foreground">{checklist.total_conformes}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted-foreground">Itens N/A:</span>
            <span className="font-semibold text-foreground">{checklist.total_na}</span>
          </div>
        </div>

        {checklist.observacoes_gerais && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Observações Gerais:</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {checklist.observacoes_gerais}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
