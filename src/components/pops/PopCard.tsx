// Card de apresentação de um POP vigente na Biblioteca de POPs.
// Somente apresentação: nenhuma regra de negócio, nenhum acesso a dados.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText } from 'lucide-react';
import { formatDateBR } from '@/utils/formatDateBR';

export interface PopCardProps {
  id: string;
  codigo: string;
  titulo: string;
  setor?: string | null;
  categoria?: string | null;
  versaoMajor: number;
  versaoMinor: number;
  elaboradoPor?: string | null;
  publicadoEm?: string | null;
  disabled?: boolean;
  onVisualizar: (id: string) => void;
}

const PopCard: React.FC<PopCardProps> = ({
  id,
  codigo,
  titulo,
  setor,
  categoria,
  versaoMajor,
  versaoMinor,
  elaboradoPor,
  publicadoEm,
  disabled = false,
  onVisualizar,
}) => {
  const setorLabel = setor?.trim() || 'Sem setor';
  const categoriaLabel = categoria?.trim() || 'Sem categoria';
  const elaboradorLabel = elaboradoPor?.trim() || 'Não informado';
  const publicacaoLabel = publicadoEm
    ? formatDateBR(publicadoEm, 'Não informada')
    : 'Não informada';

  return (
    <article className="group flex min-h-[260px] flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 motion-safe:hover:-translate-y-1 hover:shadow-md hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary"
        >
          <FileText className="h-5 w-5" />
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="outline" className="font-mono">
            {codigo}
          </Badge>
          <Badge variant="default">{`Versão ${versaoMajor}.${versaoMinor}`}</Badge>
        </div>
      </div>

      <h3 className="mt-4 text-base font-semibold leading-snug text-foreground">
        {titulo}
      </h3>

      <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <div className="flex gap-1.5">
          <dt className="font-medium text-foreground/80">Setor:</dt>
          <dd>{setorLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium text-foreground/80">Categoria:</dt>
          <dd>{categoriaLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium text-foreground/80">Elaborado por:</dt>
          <dd>{elaboradorLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium text-foreground/80">Publicado em:</dt>
          <dd>{publicacaoLabel}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-5">
        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => onVisualizar(id)}
          aria-label={`Visualizar POP ${codigo} — ${titulo}`}
        >
          Visualizar POP
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 motion-safe:group-hover:translate-x-1" />
        </Button>
      </div>
    </article>
  );
};

export default PopCard;
