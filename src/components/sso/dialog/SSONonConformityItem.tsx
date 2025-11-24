import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { SSOChecklistItem } from '@/types/sso';
import { SSOPhotoGallery } from './SSOPhotoGallery';

interface SSONonConformityItemProps {
  item: SSOChecklistItem;
  index: number;
}

export const SSONonConformityItem = ({ item, index }: SSONonConformityItemProps) => {
  return (
    <div className="border-2 border-destructive/20 rounded-lg p-3 mb-3 break-inside-avoid bg-card">
      {/* Header da Não Conformidade */}
      <div className="flex items-start justify-between mb-2 pb-2 border-b border-border">
        <div className="flex items-start gap-2 flex-1">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/30">
            <span className="text-base font-bold text-destructive">{index + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="mb-1.5 text-[10px] border-primary/30 text-primary">
              {item.tema}
            </Badge>
            <h4 className="font-semibold text-sm leading-tight text-foreground break-words">
              {item.descricao}
            </h4>
          </div>
        </div>
        <Badge variant="destructive" className="flex-shrink-0 ml-2 text-[10px]">
          Não Conforme
        </Badge>
      </div>

      {/* Evidência com melhor formatação */}
      {item.evidencia && (
        <div className="mb-2 bg-muted/30 p-2.5 rounded-md border border-border">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            📋 Evidência Objetiva:
          </p>
          <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {item.evidencia}
          </p>
        </div>
      )}

      {/* Fotos otimizadas */}
      {item.fotos && item.fotos.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            📷 Registro Fotográfico ({item.fotos.length} {item.fotos.length === 1 ? 'foto' : 'fotos'}):
          </p>
          <SSOPhotoGallery photos={item.fotos} />
        </div>
      )}
    </div>
  );
};
