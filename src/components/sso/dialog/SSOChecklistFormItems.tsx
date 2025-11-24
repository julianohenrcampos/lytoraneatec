import { ScrollArea } from '@/components/ui/scroll-area';
import { SSOChecklistItem as SSOChecklistItemType } from '@/types/sso';
import { SSOChecklistItem } from './SSOChecklistItem';
import { SSOChecklistStats } from './SSOChecklistStats';
import { ssoCalculations } from '@/utils/sso/ssoCalculations';
import { useMemo } from 'react';

interface SSOChecklistFormItemsProps {
  itens: SSOChecklistItemType[];
  onChange: (itemId: string, field: keyof SSOChecklistItemType, value: any) => void;
  onFilesChange?: (itemId: string, files: File[]) => void;
}

export const SSOChecklistFormItems = ({ itens, onChange, onFilesChange }: SSOChecklistFormItemsProps) => {
  // Calcular estatísticas em tempo real
  const stats = useMemo(() => {
    return ssoCalculations.calcularNota(itens);
  }, [itens]);

  // Agrupar itens por tema
  const itensPorTema = useMemo(() => {
    const grupos: Record<string, SSOChecklistItemType[]> = {};
    itens.forEach(item => {
      if (!grupos[item.tema]) {
        grupos[item.tema] = [];
      }
      grupos[item.tema].push(item);
    });
    return grupos;
  }, [itens]);

  return (
    <div className="space-y-4">
      <SSOChecklistStats
        nota_objetivo={100}
        nota_real={stats.nota_real}
        total_aplicaveis={stats.total_aplicaveis}
        total_conformes={stats.total_conformes}
        total_na={stats.total_na}
      />

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-6">
          {Object.entries(itensPorTema).map(([tema, itensDoTema]) => (
            <div key={tema}>
              <h3 className="text-sm font-semibold text-primary mb-3 sticky top-0 bg-background py-2 z-10">
                {tema}
              </h3>
              <div className="space-y-3">
                {itensDoTema.map((item, idx) => (
                  <SSOChecklistItem
                    key={item.id}
                    item={item}
                    index={itens.indexOf(item)}
                    onChange={onChange}
                    onFilesChange={onFilesChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
