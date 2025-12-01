import { Badge } from '@/components/ui/badge';
import { SSOChecklist } from '@/types/sso';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianDate } from '@/utils/timezoneUtils';
interface SSOChecklistViewHeaderProps {
  checklist: SSOChecklist;
  totalNaoConformidades: number;
}
export const SSOChecklistViewHeader = ({ checklist, totalNaoConformidades }: SSOChecklistViewHeaderProps) => {
  return (
    <div className="space-y-4">
      {/* Cabeçalho do Relatório */}
      <div className="text-center pb-3 border-b-2 border-primary">
        <h1 className="text-xl font-bold text-foreground">
          RELATÓRIO DE NÃO CONFORMIDADES - MTE_TAC
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {format(parseBrazilianDate(checklist.data_inspecao), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Tabela de Informações da Inspeção */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
          <h2 className="font-semibold text-sm text-foreground">Informações da Inspeção</h2>
        </div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr className="border-b border-border">
              <td className="py-1.5 px-3 bg-muted/30 font-semibold text-foreground w-1/3">Obra:</td>
              <td className="py-1.5 px-3 text-foreground">{checklist.bd_centros_custo?.nome_centro_custo}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1.5 px-3 bg-muted/30 font-semibold text-foreground">Código da Obra:</td>
              <td className="py-1.5 px-3 text-foreground">{checklist.bd_centros_custo?.codigo_centro_custo}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1.5 px-3 bg-muted/30 font-semibold text-foreground">Data da Inspeção:</td>
              <td className="py-1.5 px-3 text-foreground">
                {format(parseBrazilianDate(checklist.data_inspecao), 'dd/MM/yyyy', { locale: ptBR })}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1.5 px-3 bg-muted/30 font-semibold text-foreground">Gerente Regional:</td>
              <td className="py-1.5 px-3 text-foreground">{checklist.gerente_regional}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1.5 px-3 bg-muted/30 font-semibold text-foreground">Engenheiro da Obra:</td>
              <td className="py-1.5 px-3 text-foreground">{checklist.engenheiro_obra}</td>
            </tr>
            <tr>
              <td className="py-1.5 px-3 bg-muted/30 font-semibold text-foreground">Técnico de Segurança:</td>
              <td className="py-1.5 px-3 text-foreground">{checklist.tecnico_seguranca}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Estatísticas em linha horizontal */}
      <div className="flex justify-around items-center border-y-2 border-primary py-3 gap-2">
        <div className="text-center flex-1">
          <p className="text-[10px] text-muted-foreground mb-0.5">Resultado</p>
          <Badge 
            variant={
              checklist.resultado_avaliacao === 'Crítico' ? 'destructive' :
              checklist.resultado_avaliacao === 'Em Atenção' ? 'secondary' :
              'default'
            }
            className="text-xs font-bold px-2 py-0.5"
          >
            {checklist.resultado_avaliacao}
          </Badge>
        </div>
        
        <div className="h-8 w-px bg-border" />
        
        <div className="text-center flex-1">
          <p className="text-[10px] text-muted-foreground mb-0.5">Nota Real</p>
          <p className="text-2xl font-bold text-foreground">{checklist.nota_real?.toFixed(1)}</p>
        </div>
        
        <div className="h-8 w-px bg-border" />
        
        <div className="text-center flex-1">
          <p className="text-[10px] text-muted-foreground mb-0.5">Não Conformidades</p>
          <p className="text-2xl font-bold text-destructive">{checklist.total_itens}/{totalNaoConformidades}</p>
        </div>
        
        <div className="h-8 w-px bg-border" />
        
        <div className="text-center flex-1">
          <p className="text-[10px] text-muted-foreground mb-0.5">Total de Efetivo</p>
          <p className="text-2xl font-bold text-foreground">{checklist.total_efetivo ?? '-'}</p>
        </div>
      </div>

      {checklist.observacoes_gerais && (
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Observações Gerais:</p>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {checklist.observacoes_gerais}
          </p>
        </div>
      )}
    </div>
  );
};