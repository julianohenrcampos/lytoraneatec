import React, { useState } from "react";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Clock, CheckCircle2, Lock, Star, AlertCircle, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { UseFormReturn } from "react-hook-form";

interface ColaboradorCardProps {
  colaborador: {
    colaborador_id?: string;
    nome_colaborador: string;
    hora_inicio?: string;
    hora_fim?: string;
    presente: boolean;
    _avulso?: boolean;
    funcao_nome?: string | null;
  };
  /** Índice real no array form.colaboradores — nunca usar índice filtrado. */
  originalIndex: number;
  form: UseFormReturn<any>;
  onAvaliarColaborador?: (colaboradorId: string, nomeColaborador: string, equipeId: string) => void;
  equipeId: string;
  isEvaluated: boolean;
  canEvaluate: boolean;
  daysRemaining: number;
  alertMessage: {
    colaboradorId: string;
    message: string;
    type: "error" | "info";
  } | null;
  isEditing: boolean;
  onLiberar: (originalIndex: number) => void;
}

const ColaboradorCard: React.FC<ColaboradorCardProps> = ({
  colaborador,
  originalIndex,
  form,
  onAvaliarColaborador,
  equipeId,
  isEvaluated,
  canEvaluate,
  daysRemaining,
  alertMessage,
  isEditing,
  onLiberar,
}) => {
  const colaboradorId = colaborador.colaborador_id;
  const isAlertShown = alertMessage && alertMessage.colaboradorId === colaboradorId;
  const isAvulso = !!colaborador._avulso;

  const [confirmarLiberar, setConfirmarLiberar] = useState(false);

  const handleAvaliacaoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!colaboradorId) return;
    onAvaliarColaborador?.(colaboradorId, colaborador.nome_colaborador, equipeId);
  };

  const temDadosPreenchidos = () => {
    const c = form.getValues(`colaboradores.${originalIndex}`) || {};
    const temHora = !!c.hora_inicio || !!c.hora_fim;
    const foiAvaliado = colaboradorId ? isEvaluated : false;
    return temHora || foiAvaliado;
  };

  const handleLiberarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (temDadosPreenchidos()) {
      setConfirmarLiberar(true);
    } else {
      onLiberar(originalIndex);
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-md shadow-sm border relative",
        isAvulso
          ? "bg-amber-50/60 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
          : isEvaluated
          ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
          : !canEvaluate
          ? "bg-gray-50 border-gray-200 dark:bg-gray-800/20 dark:border-gray-800"
          : "bg-accent/20 border-accent/30"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold truncate">{colaborador.nome_colaborador}</span>
              {isAvulso && (
                <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                  <UserPlus className="h-3 w-3" />
                  Avulso
                </span>
              )}
              {isEvaluated && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Avaliado
                </span>
              )}
              {!isEvaluated && !canEvaluate && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 rounded-full flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Aguardando ({daysRemaining} dias)
                </span>
              )}
            </div>
            {colaborador.funcao_nome && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {colaborador.funcao_nome}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onAvaliarColaborador && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isEvaluated ? "ghost" : "secondary"}
                    size="sm"
                    onClick={handleAvaliacaoClick}
                    type="button"
                    aria-label="Avaliar desempenho"
                    className={cn(
                      "min-w-[100px]",
                      isEvaluated
                        ? "text-green-600 hover:text-green-700 bg-green-100 hover:bg-green-200"
                        : !canEvaluate
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-100 hover:bg-amber-200 text-amber-800"
                    )}
                  >
                    {isEvaluated ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                        Avaliado
                      </>
                    ) : !canEvaluate ? (
                      <>
                        <Lock className="h-4 w-4 mr-1 text-gray-500" />
                        Bloqueado
                      </>
                    ) : (
                      <>
                        <Star className="h-4 w-4 mr-1 text-amber-500" />
                        Avaliar
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isEvaluated
                    ? "Colaborador já avaliado"
                    : canEvaluate
                    ? "Avaliar desempenho"
                    : `Próxima avaliação em ${daysRemaining} dia(s).`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleLiberarClick}
                  aria-label="Liberar do apontamento"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Liberar do apontamento</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {isAlertShown && (
        <Alert variant={alertMessage?.type === "error" ? "destructive" : "default"} className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{alertMessage?.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
        <FormField
          control={form.control}
          name={`colaboradores.${originalIndex}.presente`}
          render={({ field }) => (
            <FormItem className="flex items-center space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={(checked) => {
                    const next = !!checked;
                    field.onChange(next);
                    // Ao desmarcar, limpar horas SÓ deste colaborador (índice original)
                    if (!next) {
                      form.setValue(`colaboradores.${originalIndex}.hora_inicio`, "", {
                        shouldDirty: true,
                      });
                      form.setValue(`colaboradores.${originalIndex}.hora_fim`, "", {
                        shouldDirty: true,
                      });
                    }
                  }}
                  className="w-5 h-5"
                />
              </FormControl>
              <span className="text-sm font-medium">Presente</span>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`colaboradores.${originalIndex}.hora_inicio`}
          render={({ field }) => {
            const presente = form.watch(`colaboradores.${originalIndex}.presente`);
            return (
              <FormItem>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="time"
                      placeholder="Hora início"
                      disabled={!presente}
                      className={!presente ? "opacity-50" : ""}
                    />
                  </FormControl>
                </div>
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name={`colaboradores.${originalIndex}.hora_fim`}
          render={({ field }) => {
            const presente = form.watch(`colaboradores.${originalIndex}.presente`);
            return (
              <FormItem>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="time"
                      placeholder="Hora fim"
                      disabled={!presente}
                      className={!presente ? "opacity-50" : ""}
                    />
                  </FormControl>
                </div>
              </FormItem>
            );
          }}
        />
      </div>

      <AlertDialog open={confirmarLiberar} onOpenChange={setConfirmarLiberar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {colaborador.nome_colaborador} possui horários ou avaliação registrados. Se
              você liberar, esses dados não serão gravados neste apontamento ao salvar.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarLiberar(false);
                onLiberar(originalIndex);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ColaboradorCard;
