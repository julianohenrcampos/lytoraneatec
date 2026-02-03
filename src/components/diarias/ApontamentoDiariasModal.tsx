// =====================================================
// MODAL: APONTAMENTO DE DIÁRIAS
// Similar ao modal de Apontamento de Equipe
// =====================================================

import React, { useEffect, useState, useMemo } from "react";
import { format, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseBrazilianDate, formatBrazilianDateForDisplay, getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// Select removed - date is now fixed to today
import {
  Calendar,
  Building2,
  User,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
// formatCurrency removed - values not displayed in UI
import type { DiariaApontamento, FuncionarioPreConvocado } from "@/types/diarias";
import {
  getPresencasPorSolicitacao,
  salvarPresencas,
  verificarPresencasExistentes,
  type PresencaFormData
} from "@/services/diarias/presencasService";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ApontamentoDiariasModalProps {
  isOpen: boolean;
  onClose: () => void;
  apontamento: DiariaApontamento | null;
  onSaveSuccess?: () => void;
}

interface ColaboradorPresenca extends PresencaFormData {
  index: number;
}

export default function ApontamentoDiariasModal({
  isOpen,
  onClose,
  apontamento,
  onSaveSuccess
}: ApontamentoDiariasModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [colaboradores, setColaboradores] = useState<ColaboradorPresenca[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // Extrair dados da solicitação
  const solicitacao = apontamento?.bd_diaria_solicitacoes;
  const centroCusto = solicitacao?.bd_centros_custo;

  // Buscar feriados para o período
  const { data: feriados = [] } = useQuery({
    queryKey: ['feriados', solicitacao?.data_inicio, solicitacao?.data_fim],
    queryFn: async () => {
      if (!solicitacao?.data_inicio || !solicitacao?.data_fim) return [];
      const { data } = await supabase
        .from('bd_feriados')
        .select('data, nome')
        .gte('data', solicitacao.data_inicio)
        .lte('data', solicitacao.data_fim);
      return data || [];
    },
    enabled: !!solicitacao?.data_inicio && !!solicitacao?.data_fim
  });

  // Verificar se hoje está no período (apontamento apenas para data atual)
  const dataHoje = useMemo(() => {
    const hoje = getCurrentBrazilianDate();
    if (!solicitacao?.data_inicio || !solicitacao?.data_fim) return null;

    // Verificar se hoje está dentro do período
    if (hoje >= solicitacao.data_inicio && hoje <= solicitacao.data_fim) {
      const feriado = feriados.find((f) => f.data === hoje);
      const hojeDate = parseBrazilianDate(hoje);
      const ehFDS = isWeekend(hojeDate);
      return {
        value: hoje,
        label: format(hojeDate, "EEEE, dd/MM/yyyy", { locale: ptBR }),
        isFeriado: !!feriado,
        nomeFeriado: feriado?.nome,
        isWeekend: ehFDS
      };
    }
    return null;
  }, [solicitacao?.data_inicio, solicitacao?.data_fim, feriados]);

  // Parsear convocados_pre
  const convocadosPre = useMemo((): FuncionarioPreConvocado[] => {
    if (!solicitacao?.convocados_pre) return [];
    if (Array.isArray(solicitacao.convocados_pre)) {
      return solicitacao.convocados_pre as FuncionarioPreConvocado[];
    }
    return [];
  }, [solicitacao?.convocados_pre]);

  // Inicializar colaboradores quando mudar a data ou abrir o modal
  useEffect(() => {
    if (!isOpen || !selectedDate || convocadosPre.length === 0) return;

    const initColaboradores = async () => {
      setIsLoadingExisting(true);

      try {
        // Verificar se já existe apontamento para esta data
        const existentes = await getPresencasPorSolicitacao(
          solicitacao?.id || "",
          selectedDate
        );

        if (existentes.length > 0) {
          setHasExistingData(true);
          // Mapear existentes para o formato do form
          const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
            const existente = existentes.find(
              (e) => e.funcionario_id === conv.funcionario_id
            );
            return {
              index,
              funcionario_id: conv.funcionario_id,
              nome_funcionario: conv.nome_funcionario || "",
              funcao_id: conv.funcao_id,
              nome_funcao: conv.nome_funcao,
              valor_diaria: existente?.valor_diaria_aplicada || conv.valor_diaria_exclusiva || conv.valor_diaria,
              presente: existente?.presente || false,
              hora_entrada: existente?.hora_entrada || "",
              hora_saida: existente?.hora_saida || ""
            };
          });
          setColaboradores(mapped);
        } else {
          setHasExistingData(false);
          // Inicializar vazio
          const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => ({
            index,
            funcionario_id: conv.funcionario_id,
            nome_funcionario: conv.nome_funcionario || "",
            funcao_id: conv.funcao_id,
            nome_funcao: conv.nome_funcao,
            valor_diaria: conv.valor_diaria_exclusiva || conv.valor_diaria,
            presente: false,
            hora_entrada: "",
            hora_saida: ""
          }));
          setColaboradores(mapped);
        }
      } catch (error) {
        console.error("Erro ao carregar presenças:", error);
        // Inicializar vazio em caso de erro
        const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => ({
          index,
          funcionario_id: conv.funcionario_id,
          nome_funcionario: conv.nome_funcionario || "",
          funcao_id: conv.funcao_id,
          nome_funcao: conv.nome_funcao,
          valor_diaria: conv.valor_diaria_exclusiva || conv.valor_diaria,
          presente: false,
          hora_entrada: "",
          hora_saida: ""
        }));
        setColaboradores(mapped);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    initColaboradores();
  }, [isOpen, selectedDate, convocadosPre, solicitacao?.id]);

  // Resetar quando abrir/fechar - usar data de hoje automaticamente
  useEffect(() => {
    if (isOpen && dataHoje) {
      setSelectedDate(dataHoje.value);
    } else if (!isOpen) {
      setSelectedDate("");
      setColaboradores([]);
      setHasExistingData(false);
      setHasSaved(false);
    }
  }, [isOpen, dataHoje]);

  // Handlers
  const handlePresencaChange = (index: number, presente: boolean) => {
    setColaboradores((prev) =>
      prev.map((col) =>
        col.index === index
          ? {
              ...col,
              presente,
              // Se marcou presente e não tem hora, coloca hora padrão
              hora_entrada: presente && !col.hora_entrada ? "07:00" : col.hora_entrada,
              hora_saida: presente && !col.hora_saida ? "17:00" : col.hora_saida
            }
          : col
      )
    );
  };

  const handleHorarioChange = (
    index: number,
    field: "hora_entrada" | "hora_saida",
    value: string
  ) => {
    setColaboradores((prev) =>
      prev.map((col) => (col.index === index ? { ...col, [field]: value } : col))
    );
  };

  const handleSalvar = async () => {
    if (!solicitacao?.id || !selectedDate) return;

    setIsSaving(true);
    try {
      await salvarPresencas(solicitacao.id, selectedDate, colaboradores);
      setHasSaved(true);
      onSaveSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar presenças:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Estatísticas
  const totalPresentes = colaboradores.filter((c) => c.presente).length;
  if (!apontamento || !solicitacao) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Apontamento de Diária
            {solicitacao?.numero_solicitacao && (
              <Badge variant="outline" className="font-mono text-xs">
                Nº {solicitacao.numero_solicitacao}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Registre a presença e horários dos funcionários para esta data
          </DialogDescription>
        </DialogHeader>

        {/* Informações da Solicitação */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="font-medium">
                  {formatBrazilianDateForDisplay(solicitacao.data_inicio)} →{" "}
                  {formatBrazilianDateForDisplay(solicitacao.data_fim)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Centro de Custo</p>
                <p className="font-medium">
                  {centroCusto?.codigo_centro_custo} - {centroCusto?.nome_centro_custo}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Data do Apontamento - Apenas Hoje */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Data do Apontamento
            </Label>

            {dataHoje ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium capitalize">{dataHoje.label}</span>
                  {dataHoje.isWeekend && (
                    <Badge variant="secondary" className="text-xs">FDS</Badge>
                  )}
                  {dataHoje.isFeriado && (
                    <Badge variant="outline" className="text-xs text-orange-600">
                      {dataHoje.nomeFeriado}
                    </Badge>
                  )}
                </div>

                {(dataHoje.isWeekend || dataHoje.isFeriado) && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {dataHoje.isFeriado
                        ? `Feriado: ${dataHoje.nomeFeriado}`
                        : "Final de semana"}
                    </AlertDescription>
                  </Alert>
                )}

                {hasExistingData && (
                  <Alert className="mt-2 bg-blue-50 text-blue-800 border-blue-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Já existe apontamento para esta data. Os dados foram carregados para edição.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A data de hoje não está dentro do período desta solicitação.
                  O apontamento só pode ser feito na data atual.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Lista de Funcionários */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Funcionários ({convocadosPre.length})</h3>
              <div className="text-sm text-muted-foreground">
                Presentes: <span className="font-medium text-primary">{totalPresentes}</span>
              </div>
            </div>

            {isLoadingExisting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : colaboradores.length > 0 ? (
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-4">
                  {colaboradores.map((colaborador) => (
                    <div
                      key={colaborador.funcionario_id}
                      className={cn(
                        "p-4 rounded-md shadow-sm border",
                        colaborador.presente
                          ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                          : "bg-accent/20 border-accent/30"
                      )}
                    >
                      {/* Header do Colaborador */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" />
                          <div>
                            <span className="font-bold">{colaborador.nome_funcionario}</span>
                            <p className="text-xs text-muted-foreground">{colaborador.nome_funcao}</p>
                          </div>
                        </div>
                      </div>

                      {/* Campos de presença e horários */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`presente-${colaborador.funcionario_id}`}
                            checked={colaborador.presente}
                            onCheckedChange={(checked) =>
                              handlePresencaChange(colaborador.index, !!checked)
                            }
                            className="w-5 h-5"
                          />
                          <label
                            htmlFor={`presente-${colaborador.funcionario_id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            Presente
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={colaborador.hora_entrada || ""}
                            onChange={(e) =>
                              handleHorarioChange(colaborador.index, "hora_entrada", e.target.value)
                            }
                            disabled={!colaborador.presente}
                            className={!colaborador.presente ? "opacity-50" : ""}
                            placeholder="Entrada"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={colaborador.hora_saida || ""}
                            onChange={(e) =>
                              handleHorarioChange(colaborador.index, "hora_saida", e.target.value)
                            }
                            disabled={!colaborador.presente}
                            className={!colaborador.presente ? "opacity-50" : ""}
                            placeholder="Saída"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {selectedDate
                  ? "Nenhum funcionário convocado para esta solicitação."
                  : "Selecione uma data para ver os funcionários."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex-col sm:flex-row gap-3 mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isSaving || hasSaved || !dataHoje || colaboradores.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar Apontamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
