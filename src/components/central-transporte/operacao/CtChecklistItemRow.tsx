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
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import type { ChecklistCeItemDef } from "@/constants/checklistCeTemplates";
import type { ChecklistValor } from "@/types/checklistCe";
import CtFotoField from "./CtFotoField";

interface Props {
  item: ChecklistCeItemDef;
  status: ChecklistValor | null;
  observacao: string;
  fotos: string[];
  onStatus: (v: ChecklistValor) => void;
  onObservacao: (v: string) => void;
  onUploadFotos: (files: File[]) => Promise<void>;
  onRemoveFoto: (path: string) => void;
  disabled?: boolean;
  invalido?: boolean;
}

/** CT-3E — Linha de item do checklist de saída (mesmas regras do checklist C&E). */
const CtChecklistItemRow: React.FC<Props> = ({
  item,
  status,
  observacao,
  fotos,
  onStatus,
  onObservacao,
  onUploadFotos,
  onRemoveFoto,
  disabled,
  invalido,
}) => {
  const exigeObs = status === "NAO_OK";
  const exigeFoto = status === "NAO_OK" && item.exigeFotoNaoOk;

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        invalido ? "border-destructive/60 bg-destructive/5" : "border-border",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{item.descricao}</span>
          {item.obrigatorio && <span className="ml-1 text-destructive">*</span>}
        </p>
        <div className="w-full shrink-0 sm:w-[180px]">
          <Select
            value={status ?? ""}
            onValueChange={(v) => onStatus(v as ChecklistValor)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecionar…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OK">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Conforme
                </span>
              </SelectItem>
              <SelectItem value="NAO_OK">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Não conforme
                </span>
              </SelectItem>
              <SelectItem value="NA">
                <span className="inline-flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-muted-foreground" /> Não aplicável
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(exigeObs || observacao) && (
        <Textarea
          rows={2}
          value={observacao}
          disabled={disabled}
          placeholder={exigeObs ? "Descreva a não conformidade (obrigatório)" : "Observação"}
          onChange={(e) => onObservacao(e.target.value)}
          className={cn(exigeObs && !observacao.trim() && "border-destructive")}
        />
      )}

      {(exigeFoto || fotos.length > 0) && (
        <CtFotoField
          inputId={`ct-checklist-foto-${item.codigo}`}
          fotos={fotos}
          onUpload={onUploadFotos}
          onRemove={onRemoveFoto}
          disabled={disabled}
        />
      )}

      {exigeFoto && fotos.length === 0 && (
        <p className="text-xs text-destructive">
          Anexe ao menos uma foto para item não conforme.
        </p>
      )}
    </div>
  );
};

export default CtChecklistItemRow;
