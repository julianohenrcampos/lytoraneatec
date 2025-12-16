import { ScrollArea } from '@/components/ui/scroll-area';
import { SSOChecklistItem as SSOChecklistItemType } from '@/types/sso';
import { SSOChecklistItem } from './SSOChecklistItem';
import { SSOChecklistStats } from './SSOChecklistStats';
import { ssoCalculations } from '@/utils/sso/ssoCalculations';
import { useMemo, useCallback, useRef } from 'react';

interface SSOChecklistFormItemsProps {
  itens: SSOChecklistItemType[];
  onChange: (itemId: string, field: keyof SSOChecklistItemType, value: any) => void;
  onFilesChange?: (itemId: string, files: File[]) => void;
  cameraOnly?: boolean;
  onScrollEnd?: (isAtEnd: boolean) => void;
}

export const SSOChecklistFormItems = ({ itens, onChange, onFilesChange, cameraOnly = false, onScrollEnd }: SSOChecklistFormItemsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
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

  // Handler para verificar se scroll chegou ao final
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!onScrollEnd) return;
    
    const target = event.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    // Considera "no final" se estiver a menos de 100px do final
    const isAtEnd = scrollTop + clientHeight >= scrollHeight - 100;
    onScrollEnd(isAtEnd);
  }, [onScrollEnd]);

  return (
    <div className="space-y-4">
      <SSOChecklistStats
        nota_objetivo={100}
        nota_real={stats.nota_real}
        total_aplicaveis={stats.total_aplicaveis}
        total_conformes={stats.total_conformes}
        total_na={stats.total_na}
      />

      <div 
        ref={scrollRef}
        className="h-[300px] sm:h-[400px] md:h-[500px] overflow-y-auto pr-2"
        onScroll={handleScroll}
      >
        <div className="space-y-6 pb-24">
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
                    cameraOnly={cameraOnly}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
