import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  itens: CentralApprovalItem[];
  selectedId: string | null;
  onSelect: (item: CentralApprovalItem) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
}

export default function CentralListaDesktop({ itens, selectedId, onSelect }: Props) {
  return (
    <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
      <ul className="divide-y">
        {itens.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                  selected && 'bg-primary/10 border-l-4 border-l-primary',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] uppercase">{item.moduloLabel}</Badge>
                      <span className="text-sm font-medium truncate">{item.protocolo}</span>
                      {item.aguardandoMinhaAcao && (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-primary/30 text-[10px]">Minha ação</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1 truncate">{item.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {item.solicitanteNome ?? '—'} · {fmtDate(item.dataReferencia)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">{item.statusLabel}</Badge>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
