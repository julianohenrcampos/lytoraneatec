import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Camera } from 'lucide-react';

interface SSOTopNaoConformidadesProps {
  items: {
    tema: string;
    descricao: string;
    percentual_nc: number;
    ocorrencias: number;
    ultima_inspecao: string;
    qtd_fotos: number;
  }[];
}

export const SSOTopNaoConformidades = ({ items }: SSOTopNaoConformidadesProps) => {
  const getSeverityColor = (percentual: number) => {
    if (percentual >= 75) return 'bg-red-100 text-red-800 border-red-200';
    if (percentual >= 50) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (percentual >= 25) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Top Não Conformidades</h3>
          <p className="text-sm text-muted-foreground">
            Itens mais frequentemente não conformes
          </p>
        </div>
        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>Nenhuma não conformidade registrada</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {item.tema}
                  </p>
                  <p className="text-sm font-medium line-clamp-2">
                    {item.descricao}
                  </p>
                </div>
                <Badge className={getSeverityColor(item.percentual_nc)}>
                  {item.percentual_nc.toFixed(0)}%
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{item.ocorrencias} ocorrência{item.ocorrencias !== 1 ? 's' : ''}</span>
                {item.qtd_fotos > 0 && (
                  <span className="flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    {item.qtd_fotos} foto{item.qtd_fotos !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
