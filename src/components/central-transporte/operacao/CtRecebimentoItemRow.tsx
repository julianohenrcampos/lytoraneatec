import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import CtFotosSomenteLeitura from "./CtFotosSomenteLeitura";

const LABEL: Record<ChecklistValor, string> = {
  OK: "Conforme",
  NAO_OK: "Não conforme",
  NA: "Não aplicável",
};

interface Props {
  item: ChecklistCeItemDef;
  saidaStatus: ChecklistValor | null;
  saidaObservacao: string | null;
  saidaFotos: string[];
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

/**
 * CT-3F.1 — Linha comparativa do recebimento: a coluna SAÍDA é evidência
 * imutável (somente leitura) e a coluna RECEBIMENTO é a nova avaliação.
 */
const CtRecebimentoItemRow: React.FC<Props> = ({
  item,
  saidaStatus,
  saidaObservacao,
  saidaFotos,
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
  const divergente = (status ?? null) !== (saidaStatus ?? null);
  const exigeObs = status === "NAO_OK";
  const exigeFoto = status === "NAO_OK" && item.exigeFotoNaoOk;

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        invalido
          ? "border-destructive/60 bg-destructive/5"
          : divergente
            ? "border-orange-400 bg-orange-50/60"
            : "border-border",
      )}
      data-testid={`ct3f-item-${item.codigo}`}
    >
      <p className="text-sm font-medium">
        {item.descricao}
        {item.obrigatorio && <span className="ml-1 text-destructive">*</span>}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border bg-muted/40 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saída</p>
          <p className="text-xs font-medium">
            {saidaStatus ? LABEL[saidaStatus] : "Não respondido"}
          </p>
          {saidaObservacao && (
            <p className="mt-1 text-[11px] text-muted-foreground">{saidaObservacao}</p>
          )}
          {saidaFotos.length > 0 && <CtFotosSomenteLeitura fotos={saidaFotos} />}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Recebimento</p>
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
          {divergente ? (
            <Badge variant="outline" className="border-orange-500 text-[10px] text-orange-700">
              Divergência identificada no recebimento
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Sem alteração
            </span>
          )}
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
          inputId={`ct-recebimento-foto-${item.codigo}`}
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

export default CtRecebimentoItemRow;
