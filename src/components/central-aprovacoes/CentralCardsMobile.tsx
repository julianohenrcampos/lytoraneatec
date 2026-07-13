import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  itens: CentralApprovalItem[];
  onSelect: (item: CentralApprovalItem) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
}

export default function CentralCardsMobile({ itens, onSelect }: Props) {
  return (
    <div className="space-y-3">
      {itens.map((item) => (
        <Card
          key={item.id}
          onClick={() => onSelect(item)}
          className="p-4 rounded-2xl shadow-sm cursor-pointer active:scale-[.99] transition"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] uppercase">{item.moduloLabel}</Badge>
            <span className="text-sm font-medium">{item.protocolo}</span>
            {item.aguardandoMinhaAcao && (
              <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Minha ação</Badge>
            )}
          </div>
          <p className="text-sm mt-2">{item.titulo}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{item.solicitanteNome ?? '—'} · {fmtDate(item.dataReferencia)}</span>
            <Badge variant="outline" className="text-[10px]">{item.statusLabel}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
