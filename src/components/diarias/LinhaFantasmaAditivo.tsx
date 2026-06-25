// =====================================================
// LINHA FANTASMA — Funcionário com aditivo pendente
// =====================================================
// Renderiza um cartão somente-leitura para um funcionário cuja
// inclusão (tipo='adicionar_funcionario') ainda aguarda aprovação.
// NÃO entra em cálculo, NÃO grava presença, NÃO toca convocados_pre.
// =====================================================

import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

interface LinhaFantasmaAditivoProps {
  aditivoId: string;
  data: string;
  snapshot: {
    funcionario_id?: string | null;
    nome?: string | null;
    nome_completo?: string | null;
    matricula?: string | null;
    funcao_nome?: string | null;
    nome_funcao?: string | null;
  } | null;
}

export function LinhaFantasmaAditivo({ aditivoId, data, snapshot }: LinhaFantasmaAditivoProps) {
  const nome = snapshot?.nome || snapshot?.nome_completo || "Funcionário";
  const matricula = snapshot?.matricula || null;
  const funcao = snapshot?.funcao_nome || snapshot?.nome_funcao || null;

  return (
    <div
      data-pending-aditivo={aditivoId}
      className="p-2.5 sm:p-4 rounded-md border border-amber-500 bg-amber-50/70 dark:bg-amber-900/15 dark:border-amber-600 opacity-90"
    >
      <div className="flex items-start gap-2 mb-2">
        <Lock className="h-4 w-4 mt-0.5 text-amber-700 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">{nome}</span>
            {matricula && (
              <span className="text-[10px] sm:text-xs text-muted-foreground">Mat. {matricula}</span>
            )}
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-700 bg-amber-50 px-1.5 py-0 text-[10px] leading-4 font-medium"
            >
              Aguardando aprovação
            </Badge>
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {funcao && <span>{funcao}</span>}
            <span>Data: {formatBrazilianDateForDisplay(data)}</span>
            <span className="italic">
              Inclusão por aditivo — controles bloqueados até aprovação.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] sm:text-xs opacity-60 pointer-events-none select-none">
        <div className="border rounded px-2 py-1 bg-muted/30">Entrada —</div>
        <div className="border rounded px-2 py-1 bg-muted/30">Saída —</div>
        <div className="border rounded px-2 py-1 bg-muted/30">Refeição —</div>
        <div className="border rounded px-2 py-1 bg-muted/30">Turno —</div>
        <div className="border rounded px-2 py-1 bg-muted/30">Salvar bloqueado</div>
      </div>
    </div>
  );
}
