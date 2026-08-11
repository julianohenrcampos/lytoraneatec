/**
 * CT-4 UX — Seção numerada de formulário (apresentacional).
 *
 * Padroniza o fluxo top-to-bottom pedido para a Movimentação Direta:
 * um bloco leve com título "N. PERGUNTA" e conteúdo agrupado, usando
 * apenas tokens semânticos do sistema (muted / border / foreground).
 */
import React from "react";

interface Props {
  numero: number;
  titulo: string;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export const SecaoNumerada: React.FC<Props> = ({
  numero,
  titulo,
  children,
  className,
  testId,
}) => (
  <section
    data-testid={testId}
    className={`space-y-2 rounded-md border bg-muted/30 px-3 py-2.5 ${className ?? ""}`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {numero}. {titulo}
    </p>
    {children}
  </section>
);

export default SecaoNumerada;
