import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualidadeNivel } from "@/hooks/ponto/useBiometriaSegura";

type Props = {
  qualidadeNivel: QualidadeNivel;
  rostoDetectado: boolean;
  motivoBloqueio?: string | null;
  className?: string;
};

const MENSAGEM_PADRAO: Record<QualidadeNivel, string> = {
  boa: "Pronto, mantenha-se assim",
  media: "Quase lá, ajuste a iluminação",
  ruim: "Aproxime-se / mais luz",
};

const ESTILOS: Record<QualidadeNivel, { wrap: string; icon: React.ReactNode }> = {
  boa: {
    wrap: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  },
  media: {
    wrap: "border-amber-500/50 bg-amber-500/15 text-amber-200",
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
  },
  ruim: {
    wrap: "border-red-500/50 bg-red-500/15 text-red-200",
    icon: <AlertCircle className="h-4 w-4" aria-hidden />,
  },
};

/**
 * Indicador de qualidade da detecção facial (anel próximo ao círculo de captura).
 * Não toma decisão de fluxo — apenas reflete o nível derivado pelo hook.
 */
export function IndicadorQualidadeRosto({
  qualidadeNivel,
  rostoDetectado,
  motivoBloqueio,
  className,
}: Props) {
  const nivel: QualidadeNivel = rostoDetectado ? qualidadeNivel : "ruim";
  const estilo = ESTILOS[nivel];
  // Mensagem prioritária do pipeline (motivoBloqueio) sobrescreve a padrão de qualidade
  const texto = motivoBloqueio || MENSAGEM_PADRAO[nivel];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md shadow-md",
        estilo.wrap,
        className,
      )}
    >
      {estilo.icon}
      <span className="leading-none">{texto}</span>
    </div>
  );
}
