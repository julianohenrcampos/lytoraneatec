/**
 * Badge visual sutil que sinaliza um bloco de UI como "Preview de Lotes".
 *
 * Componente puro — sem props obrigatórias, sem efeito, sem fetch, sem
 * mutação. Usado exclusivamente pelo `LotesPreviewPanel` (Fase 1C).
 */
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LotesPreviewBadgeProps {
  className?: string;
}

export function LotesPreviewBadge({ className }: LotesPreviewBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      <Eye className="h-3 w-3" />
      <span>Preview de Lotes</span>
    </Badge>
  );
}
