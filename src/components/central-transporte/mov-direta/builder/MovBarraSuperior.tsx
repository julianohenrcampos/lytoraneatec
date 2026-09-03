/**
 * CT-4 Builder — Barra superior: DATA PADRÃO, MODALIDADE e TIPO DE TRANSPORTE.
 *
 * Substitui os grandes selects da antiga etapa "Origem da coleta" por pills
 * (segmented buttons). Nenhum campo novo: escreve exatamente
 * `dataPrevistaSaida`, `modalidade` e `tipoTransporte` do rascunho.
 */
import React from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CT_MODALIDADE_LABELS,
  CT_TIPO_TRANSPORTE_LABELS,
  type CtModalidade,
  type CtTipoTransporte,
} from "@/types/centralTransporteMobilizacao";

export interface MovBarraSuperiorProps {
  dataPrevistaSaida: string;
  modalidade: CtModalidade | null;
  tipoTransporte: CtTipoTransporte | null;
  somenteLeitura: boolean;
  onData: (valor: string) => void;
  onModalidade: (valor: CtModalidade | null) => void;
  onTipoTransporte: (valor: CtTipoTransporte | null) => void;
}

const Pill: React.FC<{
  ativo: boolean;
  desabilitado: boolean;
  testId: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ ativo, desabilitado, testId, onClick, children }) => (
  <Button
    type="button"
    size="sm"
    variant={ativo ? "default" : "outline"}
    disabled={desabilitado}
    aria-pressed={ativo}
    data-testid={testId}
    className={cn("h-7 rounded-full px-3 text-[11px]", !ativo && "text-muted-foreground")}
    onClick={onClick}
  >
    {children}
  </Button>
);

export const MovBarraSuperior: React.FC<MovBarraSuperiorProps> = ({
  dataPrevistaSaida,
  modalidade,
  tipoTransporte,
  somenteLeitura,
  onData,
  onModalidade,
  onTipoTransporte,
}) => (
  <div
    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/30 px-3 py-2"
    data-testid="ct4-barra-superior"
  >
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> Data padrão
      </span>
      <Input
        type="date"
        value={dataPrevistaSaida}
        disabled={somenteLeitura}
        className="h-7 w-[140px] text-[11px]"
        aria-label="Data padrão da movimentação"
        data-testid="ct4-data-padrao"
        onChange={(e) => onData(e.target.value)}
      />
    </div>

    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
        Modalidade
      </span>
      <div className="flex items-center gap-1">
        {(Object.keys(CT_MODALIDADE_LABELS) as CtModalidade[]).map((m) => (
          <Pill
            key={m}
            ativo={modalidade === m}
            desabilitado={somenteLeitura}
            testId={`ct4-pill-modalidade-${m}`}
            onClick={() => onModalidade(modalidade === m ? null : m)}
          >
            {CT_MODALIDADE_LABELS[m]}
          </Pill>
        ))}
      </div>
    </div>

    {modalidade === "TRANSPORTADO" && (
      <div className="flex items-center gap-2" data-testid="ct4-tipo-transporte-pills">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Tipo de transporte
        </span>
        <div className="flex items-center gap-1">
          {(Object.keys(CT_TIPO_TRANSPORTE_LABELS) as CtTipoTransporte[]).map((t) => (
            <Pill
              key={t}
              ativo={tipoTransporte === t}
              desabilitado={somenteLeitura}
              testId={`ct4-pill-tipo-${t}`}
              onClick={() => onTipoTransporte(tipoTransporte === t ? null : t)}
            >
              {CT_TIPO_TRANSPORTE_LABELS[t]}
            </Pill>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default MovBarraSuperior;
