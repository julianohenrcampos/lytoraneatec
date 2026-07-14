import React from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import type { ChecklistCeItemDef } from "@/constants/checklistCeTemplates";
import type { ChecklistValor } from "@/types/checklistCe";
import ChecklistFotoField from "./ChecklistFotoField";

interface FotoLocal {
  localId: string;
  file: File;
  previewUrl: string;
}

interface Props {
  item: ChecklistCeItemDef;
  status?: ChecklistValor;
  observacao: string;
  fotosSalvas: string[];
  fotosNovas: FotoLocal[];
  onStatus: (v: ChecklistValor) => void;
  onObservacao: (v: string) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveLocal: (localId: string) => void;
  onRemoveSalva: (path: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}

const STATUS_STYLES: Record<ChecklistValor, { trigger: string; label: string }> = {
  OK: {
    trigger:
      "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:ring-emerald-500",
    label: "Conforme",
  },
  NAO_OK: {
    trigger:
      "border-red-500 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500",
    label: "Não conforme",
  },
  NA: {
    trigger:
      "border-orange-500 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500",
    label: "Não aplicável",
  },
};

const ChecklistItemRow: React.FC<Props> = ({
  item,
  status,
  observacao,
  fotosSalvas,
  fotosNovas,
  onStatus,
  onObservacao,
  onAddFiles,
  onRemoveLocal,
  onRemoveSalva,
  disabled,
  invalid,
}) => {
  const needsObs = status === "NAO_OK";
  const needsFoto = status === "NAO_OK" && item.exigeFotoNaoOk;
  const style = status ? STATUS_STYLES[status] : null;

  return (
    <div
      className={cn(
        "border rounded-lg p-3 space-y-2 min-h-[56px] bg-background",
        invalid ? "border-red-400 bg-red-50/40" : "border-border"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm flex-1 min-w-0">
          <span className="font-medium">{item.descricao}</span>
          {item.obrigatorio && <span className="text-red-500 ml-1">*</span>}
        </div>
        <div className="shrink-0 w-full sm:w-[180px]">
          <Select
            value={status ?? ""}
            onValueChange={(v) => onStatus(v as ChecklistValor)}
            disabled={disabled}
          >
            <SelectTrigger
              className={cn(
                "h-9 text-sm font-medium border-2",
                style?.trigger,
                !status && "border-muted-foreground/30"
              )}
            >
              <SelectValue placeholder="Selecionar…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OK">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Conforme
                </span>
              </SelectItem>
              <SelectItem value="NAO_OK">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Não conforme
                </span>
              </SelectItem>
              <SelectItem value="NA">
                <span className="inline-flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-orange-500" />
                  Não aplicável
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(needsObs || observacao) && (
        <Textarea
          placeholder={needsObs ? "Descreva a não conformidade (obrigatório)" : "Observação"}
          value={observacao}
          disabled={disabled}
          onChange={(e) => onObservacao(e.target.value)}
          rows={2}
          className={cn(needsObs && !observacao.trim() && "border-red-400")}
        />
      )}

      <ChecklistFotoField
        itemCodigo={item.codigo}
        fotosSalvas={fotosSalvas}
        fotosNovas={fotosNovas}
        onAddFiles={onAddFiles}
        onRemoveLocal={onRemoveLocal}
        onRemoveSalva={onRemoveSalva}
        disabled={disabled}
      />

      {needsFoto && fotosSalvas.length + fotosNovas.length === 0 && (
        <p className="text-xs text-red-600">Anexe ao menos uma foto para NÃO conforme.</p>
      )}
    </div>
  );
};

export default ChecklistItemRow;
