// =====================================================
// MODAL: APONTAMENTO DE DIÁRIAS
// Fluxo em dois tempos: Início → Finalização (imutável)
// =====================================================

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Building2,
  User,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  UtensilsCrossed,
  Lock
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DiariaApontamento, FuncionarioPreConvocado } from "@/types/diarias";
import {
  getPresencasPorSolicitacao,
  salvarInicio,
  salvarFinalizacao,
  type PresencaFormData,
  type TipoDiaria,
  type InicioFormData,
  type FinalizacaoFormData
} from "@/services/diarias/presencasService";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApontamentoDiariasModalProps {
  isOpen: boolean;
  onClose: () => void;
  apontamento: DiariaApontamento | null;
  onSaveSuccess?: () => void;
}

interface ColaboradorPresenca extends PresencaFormData {
  index: number;
}

type FaseApontamento = 'inicio' | 'finalizacao' | 'concluido';

// Calcula horas trabalhadas e tipo de diária
function calcularJornada(entrada: string | undefined, saida: string | undefined): { horas: number; tipo: TipoDiaria } {
  if (!entrada || !saida) return { horas: 0, tipo: 'nenhuma' };

  const [hE, mE] = entrada.split(':').map(Number);
  const [hS, mS] = saida.split(':').map(Number);
  
  let totalMinutos = (hS * 60 + mS) - (hE * 60 + mE);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  
  const horas = totalMinutos / 60;

  if (horas > 4 + 20/60) return { horas, tipo: 'completa' };
  if (horas > 0) return { horas, tipo: 'meia' };
  return { horas, tipo: 'nenhuma' };
}

function calcularValorDiaria(valorOriginal: number, tipo: TipoDiaria): number {
  switch (tipo) {
    case 'completa': return valorOriginal;
    case 'meia': return valorOriginal * 0.5;
    case 'nenhuma': return 0;
  }
}

function getBadgeJornada(tipo: TipoDiaria, horas: number) {
  const horasStr = horas > 0 ? ` ${horas.toFixed(1)}h` : '';
  switch (tipo) {
    case 'completa':
      return <Badge variant="success" className="text-xs">Completa{horasStr}</Badge>;
    case 'meia':
      return <Badge variant="warning" className="text-xs">Meia{horasStr}</Badge>;
    case 'nenhuma':
      return horas > 0 
        ? <Badge variant="destructive" className="text-xs">&lt; 4h20{horasStr}</Badge>
        : null;
  }
}

// Determinar fase baseado nos dados existentes
function determinarFase(colaboradores: ColaboradorPresenca[], hasExisting: boolean): FaseApontamento {
  if (!hasExisting) return 'inicio';
  
  // Se algum presente tem hora_saida preenchida, está concluído
  const presentes = colaboradores.filter(c => c.presente);
  if (presentes.length === 0) return 'concluido'; // Todos ausentes = concluído
  
  const algumComSaida = presentes.some(c => c.hora_saida);
  if (algumComSaida) return 'concluido';
  
  // Tem dados salvos mas sem saída = finalização
  return 'finalizacao';
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
  const [fase, setFase] = useState<FaseApontamento>('inicio');

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

  // Buscar valor_refeicao das funções
  const { data: funcoesMap = {} } = useQuery({
    queryKey: ['funcoes-refeicao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcoes')
        .select('id, valor_refeicao');
      const map: Record<string, number> = {};
      (data || []).forEach(f => { map[f.id] = f.valor_refeicao || 0; });
      return map;
    }
  });

  // Verificar se hoje está no período
  const dataHoje = useMemo(() => {
    const hoje = getCurrentBrazilianDate();
    if (!solicitacao?.data_inicio || !solicitacao?.data_fim) return null;

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
        const existentes = await getPresencasPorSolicitacao(
          solicitacao?.id || "",
          selectedDate
        );

        if (existentes.length > 0) {
          setHasExistingData(true);
          const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
            const existente = existentes.find(
              (e) => e.funcionario_id === conv.funcionario_id
            );
            const valorOriginal = conv.valor_diaria_exclusiva || conv.valor_diaria;
            return {
              index,
              funcionario_id: conv.funcionario_id,
              nome_funcionario: conv.nome_funcionario || "",
              funcao_id: conv.funcao_id,
              nome_funcao: conv.nome_funcao,
              valor_diaria_original: valorOriginal,
              valor_diaria: existente?.valor_diaria_aplicada || valorOriginal,
              presente: existente?.presente || false,
              hora_entrada: existente?.hora_entrada || "",
              hora_saida: existente?.hora_saida || "",
              tipo_diaria: (existente?.tipo_diaria as TipoDiaria) || 'completa',
              recebe_refeicao: existente?.recebe_refeicao ?? true,
              valor_refeicao_aplicado: existente?.valor_refeicao_aplicado ?? 0
            };
          });
          setColaboradores(mapped);
          setFase(determinarFase(mapped, true));
        } else {
          setHasExistingData(false);
          const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
            const valorOriginal = conv.valor_diaria_exclusiva || conv.valor_diaria;
            return {
              index,
              funcionario_id: conv.funcionario_id,
              nome_funcionario: conv.nome_funcionario || "",
              funcao_id: conv.funcao_id,
              nome_funcao: conv.nome_funcao,
              valor_diaria_original: valorOriginal,
              valor_diaria: valorOriginal,
              presente: false,
              hora_entrada: "",
              hora_saida: "",
              tipo_diaria: 'completa',
              recebe_refeicao: true,
              valor_refeicao_aplicado: 0
            };
          });
          setColaboradores(mapped);
          setFase('inicio');
        }
      } catch (error) {
        console.error("Erro ao carregar presenças:", error);
        const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
          const valorOriginal = conv.valor_diaria_exclusiva || conv.valor_diaria;
          return {
            index,
            funcionario_id: conv.funcionario_id,
            nome_funcionario: conv.nome_funcionario || "",
            funcao_id: conv.funcao_id,
            nome_funcao: conv.nome_funcao,
            valor_diaria_original: valorOriginal,
            valor_diaria: valorOriginal,
            presente: false,
            hora_entrada: "",
            hora_saida: "",
            tipo_diaria: 'completa',
            recebe_refeicao: true,
            valor_refeicao_aplicado: 0
          };
        });
        setColaboradores(mapped);
        setFase('inicio');
      } finally {
        setIsLoadingExisting(false);
      }
    };

    initColaboradores();
  }, [isOpen, selectedDate, convocadosPre, solicitacao?.id]);

  // Resetar quando abrir/fechar
  useEffect(() => {
    if (isOpen && dataHoje) {
      setSelectedDate(dataHoje.value);
    } else if (!isOpen) {
      setSelectedDate("");
      setColaboradores([]);
      setHasExistingData(false);
      setHasSaved(false);
      setFase('inicio');
    }
  }, [isOpen, dataHoje]);

  // Recalcular jornada ao mudar horários
  const recalcularJornada = useCallback((col: ColaboradorPresenca): ColaboradorPresenca => {
    if (!col.presente) {
      return { ...col, tipo_diaria: 'nenhuma', valor_diaria: 0 };
    }
    const { tipo } = calcularJornada(col.hora_entrada, col.hora_saida);
    const novoValor = calcularValorDiaria(col.valor_diaria_original, tipo);
    return { ...col, tipo_diaria: tipo, valor_diaria: novoValor };
  }, []);

  // Handlers
  const handlePresencaChange = (index: number, presente: boolean) => {
    if (fase !== 'inicio') return; // Só pode mudar presença na fase início
    setColaboradores((prev) =>
      prev.map((col) => {
        if (col.index !== index) return col;
        const updated = {
          ...col,
          presente,
          hora_entrada: presente && !col.hora_entrada ? format(new Date(), 'HH:mm') : col.hora_entrada,
          hora_saida: col.hora_saida,
          recebe_refeicao: presente ? col.recebe_refeicao : false
        };
        return recalcularJornada(updated);
      })
    );
  };

  const handleHorarioChange = (
    index: number,
    field: "hora_entrada" | "hora_saida",
    value: string
  ) => {
    // Na fase início, só pode editar entrada; na finalização, só saída
    if (fase === 'inicio' && field === 'hora_saida') return;
    if (fase === 'finalizacao' && field === 'hora_entrada') return;
    if (fase === 'concluido') return;

    setColaboradores((prev) =>
      prev.map((col) => {
        if (col.index !== index) return col;
        if (!col.presente) return col; // Ausentes não editam horários
        const updated = { ...col, [field]: value };
        return recalcularJornada(updated);
      })
    );
  };

  const handleRefeicaoChange = (index: number, recebe: boolean) => {
    if (fase !== 'finalizacao') return; // Só edita refeição na finalização
    setColaboradores((prev) =>
      prev.map((col) =>
        col.index === index ? { ...col, recebe_refeicao: recebe } : col
      )
    );
  };

  // Salvar Início
  const handleSalvarInicio = async () => {
    if (!solicitacao?.id || !selectedDate) return;

    setIsSaving(true);
    try {
      const registros: InicioFormData[] = colaboradores.map(col => ({
        funcionario_id: col.funcionario_id,
        funcao_id: col.funcao_id,
        presente: col.presente,
        hora_entrada: col.presente ? col.hora_entrada : undefined,
        valor_diaria_original: col.valor_diaria_original
      }));

      await salvarInicio(solicitacao.id, selectedDate, registros);
      setHasSaved(true);
      setFase('finalizacao');
      setHasExistingData(true);
      toast.success('Início do apontamento salvo com sucesso!');
      onSaveSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar início:", error);
      toast.error('Erro ao salvar início do apontamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Salvar Finalização
  const handleSalvarFinalizacao = async () => {
    if (!solicitacao?.id || !selectedDate) return;

    setIsSaving(true);
    try {
      const presentes = colaboradores.filter(c => c.presente);
      const registros: FinalizacaoFormData[] = presentes.map(col => {
        const { tipo } = calcularJornada(col.hora_entrada, col.hora_saida);
        const valorFinal = calcularValorDiaria(col.valor_diaria_original, tipo);
        return {
          funcionario_id: col.funcionario_id,
          hora_saida: col.hora_saida || '',
          tipo_diaria: tipo,
          valor_diaria_aplicada: valorFinal,
          recebe_refeicao: col.recebe_refeicao ?? true,
          valor_refeicao_aplicado: col.recebe_refeicao ? (funcoesMap[col.funcao_id] || 0) : 0
        };
      });

      await salvarFinalizacao(solicitacao.id, selectedDate, registros);
      setHasSaved(true);
      setFase('concluido');
      toast.success('Apontamento finalizado com sucesso!');
      onSaveSuccess?.();
    } catch (error: any) {
      console.error("Erro ao finalizar:", error);
      toast.error('Erro ao finalizar apontamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Estatísticas
  const totalPresentes = colaboradores.filter((c) => c.presente).length;
  if (!apontamento || !solicitacao) return null;

  const faseLabel = {
    inicio: { text: 'Registrar Entrada', color: 'text-blue-600' },
    finalizacao: { text: 'Registrar Saída', color: 'text-orange-600' },
    concluido: { text: 'Concluído', color: 'text-green-600' }
  };

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
                  {/* Badge da fase */}
                  <Badge
                    variant={fase === 'concluido' ? 'success' : fase === 'finalizacao' ? 'warning' : 'secondary'}
                    className="ml-auto text-xs"
                  >
                    {faseLabel[fase].text}
                  </Badge>
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

                {fase === 'finalizacao' && (
                  <Alert className="mt-2 bg-orange-50 text-orange-800 border-orange-200">
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Início já registrado. Preencha a hora de saída e refeição para finalizar.
                    </AlertDescription>
                  </Alert>
                )}

                {fase === 'concluido' && (
                  <Alert className="mt-2 bg-green-50 text-green-800 border-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Apontamento finalizado. Todos os dados estão travados.
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
              <div className="text-sm text-muted-foreground flex items-center gap-3">
                <span>Presentes: <span className="font-medium text-primary">{totalPresentes}</span></span>
                <span>Faltas: <span className="font-medium text-destructive">{colaboradores.length - totalPresentes}</span></span>
              </div>
            </div>

            {isLoadingExisting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : colaboradores.length > 0 ? (
              <ScrollArea className="h-[350px] border rounded-md p-4">
                <div className="space-y-4">
                  {colaboradores.map((colaborador) => {
                    const { horas, tipo } = calcularJornada(colaborador.hora_entrada, colaborador.hora_saida);
                    const valorRefeicao = funcoesMap[colaborador.funcao_id] || 0;

                    // Lógica de campos travados por fase
                    const presencaDisabled = fase !== 'inicio';
                    const entradaDisabled = fase !== 'inicio' || !colaborador.presente;
                    const saidaDisabled = fase !== 'finalizacao' || !colaborador.presente;
                    const refeicaoDisabled = fase !== 'finalizacao' || !colaborador.presente;

                    return (
                      <div
                        key={colaborador.funcionario_id}
                        className={cn(
                          "p-4 rounded-md shadow-sm border",
                          fase === 'concluido'
                            ? colaborador.presente
                              ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                              : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                            : colaborador.presente && colaborador.hora_saida
                              ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                              : colaborador.presente && !colaborador.hora_saida
                                ? "bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-800"
                                : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                        )}
                      >
                        {/* Linha 1: Nome + Função + Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            <div>
                              <span className="font-bold">{colaborador.nome_funcionario}</span>
                              <p className="text-xs text-muted-foreground">{colaborador.nome_funcao}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {fase === 'concluido' && colaborador.presente ? (
                              <>
                                {getBadgeJornada(tipo, horas)}
                                <Badge variant="success" className="text-xs flex items-center gap-1">
                                  <Lock className="h-3 w-3" /> Finalizado
                                </Badge>
                              </>
                            ) : colaborador.presente ? (
                              colaborador.hora_saida
                                ? getBadgeJornada(tipo, horas)
                                : <Badge variant="warning" className="text-xs">Em andamento</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Falta</Badge>
                            )}
                          </div>
                        </div>

                        {/* Linha 2: Checkbox Presente + Entrada + Saída */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`presente-${colaborador.funcionario_id}`}
                              checked={colaborador.presente}
                              onCheckedChange={(checked) =>
                                handlePresencaChange(colaborador.index, !!checked)
                              }
                              disabled={presencaDisabled}
                              className="w-5 h-5"
                            />
                            <label
                              htmlFor={`presente-${colaborador.funcionario_id}`}
                              className={cn("text-sm font-medium", presencaDisabled ? "opacity-60" : "cursor-pointer")}
                            >
                              Presente
                            </label>
                            {presencaDisabled && colaborador.presente && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={colaborador.hora_entrada || ""}
                              onChange={(e) =>
                                handleHorarioChange(colaborador.index, "hora_entrada", e.target.value)
                              }
                              disabled={entradaDisabled}
                              className={cn(entradaDisabled ? "opacity-50" : "")}
                              placeholder="Entrada"
                            />
                            {fase !== 'inicio' && colaborador.hora_entrada && (
                              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={colaborador.hora_saida || ""}
                              onChange={(e) =>
                                handleHorarioChange(colaborador.index, "hora_saida", e.target.value)
                              }
                              disabled={saidaDisabled}
                              className={cn(saidaDisabled && fase !== 'finalizacao' ? "opacity-50" : "")}
                              placeholder="Saída"
                            />
                            {fase === 'concluido' && colaborador.hora_saida && (
                              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Linha 3: Toggle Refeição (visível na finalização e concluído) */}
                        {(fase === 'finalizacao' || fase === 'concluido') && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed">
                            <div className="flex items-center gap-2">
                              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                              <Label
                                htmlFor={`refeicao-${colaborador.funcionario_id}`}
                                className="text-sm cursor-pointer"
                              >
                                Refeição
                              </Label>
                              {colaborador.presente && colaborador.recebe_refeicao && valorRefeicao > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  (R$ {valorRefeicao.toFixed(2)})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`refeicao-${colaborador.funcionario_id}`}
                                checked={!!colaborador.recebe_refeicao}
                                onCheckedChange={(checked) =>
                                  handleRefeicaoChange(colaborador.index, checked)
                                }
                                disabled={refeicaoDisabled}
                              />
                              {fase === 'concluido' && (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
            {fase === 'concluido' ? 'Fechar' : 'Cancelar'}
          </Button>

          {fase === 'inicio' && (
            <Button
              onClick={handleSalvarInicio}
              disabled={isSaving || hasSaved || !dataHoje || colaboradores.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Salvar Início
                </>
              )}
            </Button>
          )}

          {fase === 'finalizacao' && (
            <Button
              onClick={handleSalvarFinalizacao}
              disabled={isSaving || !dataHoje || colaboradores.length === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Salvar Finalização
                </>
              )}
            </Button>
          )}

          {fase === 'concluido' && (
            <Badge variant="success" className="text-sm px-4 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Apontamento Concluído
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
