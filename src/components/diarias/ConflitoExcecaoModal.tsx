// =====================================================
// ConflitoExcecaoModal
// Diálogo único para resolver conflito quando funcionário
// já tem presença real em outra solicitação no mesmo dia.
// Ações:
//  - Cancelar
//  - Solicitar transferência (qualquer usuário autenticado)
//  - Incluir como exceção (apenas SuperAdm / AdmObra / Gerente)
// =====================================================

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ConflitoExcecaoData {
  funcionarioNome: string;
  numeroSolicitacao?: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  data: string; // ISO yyyy-MM-dd
}

interface ConflitoExcecaoModalProps {
  isOpen: boolean;
  conflito: ConflitoExcecaoData | null;
  podeIncluirExcecao: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSolicitarTransferencia: (justificativa: string) => Promise<void> | void;
  onIncluirExcecao: (justificativa: string) => Promise<void> | void;
}

const MIN_JUSTIFICATIVA = 20;

export function ConflitoExcecaoModal({
  isOpen,
  conflito,
  podeIncluirExcecao,
  isSubmitting,
  onCancel,
  onSolicitarTransferencia,
  onIncluirExcecao,
}: ConflitoExcecaoModalProps) {
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    if (!isOpen) setJustificativa("");
  }, [isOpen]);

  const trimmed = justificativa.trim();
  const isValid = trimmed.length >= MIN_JUSTIFICATIVA;
  const remaining = Math.max(0, MIN_JUSTIFICATIVA - trimmed.length);

  const dataFormatada = useMemo(() => {
    if (!conflito?.data) return "";
    try {
      // Evita off-by-one: parse manual yyyy-MM-dd como local
      const [y, m, d] = conflito.data.split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      return format(dt, "dd/MM/yyyy (EEE)", { locale: ptBR });
    } catch {
      return conflito.data;
    }
  }, [conflito?.data]);

  const ccDisplay = useMemo(() => {
    if (!conflito) return "—";
    const parts: string[] = [];
    if (conflito.centroCustoCodigo) parts.push(conflito.centroCustoCodigo);
    if (conflito.centroCustoNome) parts.push(conflito.centroCustoNome);
    return parts.length > 0 ? parts.join(" — ") : "—";
  }, [conflito]);

  const handleTransferir = async () => {
    if (!isValid) return;
    await onSolicitarTransferencia(trimmed);
  };

  const handleExcecao = async () => {
    if (!isValid) return;
    await onIncluirExcecao(trimmed);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Conflito de alocação
          </DialogTitle>
          <DialogDescription>
            Este funcionário já possui apontamento ativo em outra obra nesta data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="font-medium">{conflito?.funcionarioNome ?? "—"}</div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Solicitação:</span>{" "}
              {conflito?.numeroSolicitacao ?? "—"}
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Centro de custo:</span>{" "}
              {ccDisplay}
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Data:</span>{" "}
              {dataFormatada}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="justificativa-excecao" className="text-sm">
                Justificativa <span className="text-destructive">*</span>
              </Label>
              <Badge variant={isValid ? "secondary" : "outline"} className="text-[10px]">
                {trimmed.length}/{MIN_JUSTIFICATIVA}
              </Badge>
            </div>
            <Textarea
              id="justificativa-excecao"
              placeholder="Descreva o motivo operacional para esta inclusão excepcional (mínimo 20 caracteres)..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-[90px] text-sm"
              disabled={isSubmitting}
            />
            {!isValid && trimmed.length > 0 && (
              <p className="text-xs text-destructive">
                Faltam {remaining} caracteres.
              </p>
            )}
          </div>

          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            ⚠ Exceções <strong>não entram no pagamento automático</strong>.
            A liberação financeira exige aprovação posterior pelo responsável.
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={handleTransferir}
            disabled={!isValid || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            )}
            Solicitar transferência
          </Button>
          {podeIncluirExcecao && (
            <Button
              onClick={handleExcecao}
              disabled={!isValid || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Incluir como exceção
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConflitoExcecaoModal;
