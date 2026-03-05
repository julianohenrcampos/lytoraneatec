// =====================================================
// MODAL: APONTAMENTO DE DIÁRIAS
// Fluxo em dois tempos: Início → Finalização (imutável)
// =====================================================

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { format, isWeekend, eachDayOfInterval, isAfter, startOfDay } from "date-fns";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
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
  Lock,
  Printer,
  CheckSquare,
  Square,
  Plus,
  Search,
  AlertTriangle,
  Pencil,
  Save,
  X
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DiariaApontamento, FuncionarioPreConvocado } from "@/types/diarias";
import {
  getPresencasPorSolicitacao,
  salvarInicio,
  salvarInicioParcial,
  atualizarFaltaParaPresente,
  salvarFinalizacao,
  salvarSaidaIndividual,
  salvarCorrecao,
  editarHoraSaida,
  type PresencaFormData,
  type TipoDiaria,
  type InicioFormData,
  type FinalizacaoFormData,
  type CorrecaoFormData
} from "@/services/diarias/presencasService";
import {
  adicionarFuncionarioConvocado,
  removerFuncionarioConvocado,
  verificarFuncionarioEmOutraSolicitacao
} from "@/services/diarias/solicitacoesService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateListaPresencaPDF } from "@/services/pdfService";
import type { ListaPresencaItem } from "@/components/diarias/pdf/ListaPresencaPDF";

interface ApontamentoDiariasModalProps {
  isOpen: boolean;
  onClose: () => void;
  apontamento: DiariaApontamento | null;
  onSaveSuccess?: () => void;
  readOnly?: boolean;
  edicaoLiberada?: boolean;
  initialDate?: string;
  isSuperAdmin?: boolean;
}

interface ColaboradorPresenca extends PresencaFormData {
  index: number;
  presencaId?: string; // ID da presença no banco para edição pós-conclusão
  usarDiariaExclusiva: boolean; // Toggle manual: usar valor FDS/Feriado
  valor_diaria_normal: number; // Valor diária normal (seg-sáb)
  valor_diaria_exclusiva_valor: number; // Valor diária exclusiva (dom/feriado)
}

type FaseApontamento = 'inicio' | 'finalizacao' | 'concluido';

// Calcula horas trabalhadas e tipo de diária
function calcularJornada(entrada: string | undefined, saida: string | undefined): { horas: number; tipo: TipoDiaria; excede12h: boolean } {
  if (!entrada || !saida) return { horas: 0, tipo: 'nenhuma', excede12h: false };

  const [hE, mE] = entrada.split(':').map(Number);
  const [hS, mS] = saida.split(':').map(Number);
  
  let totalMinutos = (hS * 60 + mS) - (hE * 60 + mE);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  
  const horas = totalMinutos / 60;

  if (horas > 12) return { horas, tipo: 'uma_e_meia', excede12h: true };
  if (horas > 9) return { horas, tipo: 'uma_e_meia', excede12h: false };
  if (horas > 4 + 20/60) return { horas, tipo: 'completa', excede12h: false };
  if (horas > 0) return { horas, tipo: 'meia', excede12h: false };
  return { horas, tipo: 'nenhuma', excede12h: false };
}

function calcularValorDiaria(valorOriginal: number, tipo: TipoDiaria): number {
  switch (tipo) {
    case 'uma_e_meia': return valorOriginal * 1.5;
    case 'completa': return valorOriginal;
    case 'meia': return valorOriginal * 0.5;
    case 'nenhuma': return 0;
  }
}

function getBadgeJornada(tipo: TipoDiaria, horas: number) {
  const horasStr = horas > 0 ? ` ${horas.toFixed(1)}h` : '';
  switch (tipo) {
    case 'uma_e_meia':
      return <Badge className="text-xs bg-blue-600 text-white">1½ Diária{horasStr}</Badge>;
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
  
  const presentes = colaboradores.filter(c => c.presente);
  if (presentes.length === 0) return 'concluido';
  
  // Só marca concluído quando TODOS os presentes têm saída
  const todosComSaida = presentes.every(c => c.hora_saida);
  if (todosComSaida) return 'concluido';
  
  return 'finalizacao';
}

export default function ApontamentoDiariasModal({
  isOpen,
  onClose,
  apontamento,
  onSaveSuccess,
  readOnly = false,
  edicaoLiberada = false,
  initialDate,
  isSuperAdmin = false
}: ApontamentoDiariasModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [colaboradores, setColaboradores] = useState<ColaboradorPresenca[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [fase, setFase] = useState<FaseApontamento>('inicio');
  
  // Estado para adicionar funcionário avulso
  const [showAddFuncionario, setShowAddFuncionario] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingFuncionario, setIsAddingFuncionario] = useState(false);
  
  // Estado para edição de hora de saída pós-conclusão
  const [editingExitId, setEditingExitId] = useState<string | null>(null);
  const [editExitTime, setEditExitTime] = useState("");
  const [editJustificativa, setEditJustificativa] = useState("");
  
  // Estado para observação obrigatória na correção (edicaoLiberada)
  const [observacaoCorrecao, setObservacaoCorrecao] = useState("");
  
  // Estado para saídas salvas individualmente
  const [saidasSalvas, setSaidasSalvas] = useState<Set<string>>(new Set());
  const [isSavingIndividual, setIsSavingIndividual] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Rastrear funcionários avulsos (adicionados via "+ Adicionar")
  const [funcionariosAvulsos, setFuncionariosAvulsos] = useState<Set<string>>(new Set());
  
  // Rastrear funcionários que eram "falta" e foram convertidos para "presente" (atrasados com presencaId)
  const [faltaConvertida, setFaltaConvertida] = useState<Set<string>>(new Set());

  // Ref para evitar auto-finalização duplicada por data
  const autoFinalizadoRef = useRef<Set<string>>(new Set());

  const queryClient = useQueryClient();

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

  // Buscar funcionários ativos para adicionar avulso
  const { data: funcionariosAtivos = [] } = useQuery({
    queryKey: ['funcionarios-ativos-diarias'],
    queryFn: async () => {
      const { data } = await supabase
        .rpc('get_funcionarios_para_diarias');
      return data || [];
    },
    enabled: showAddFuncionario
  });

  // Buscar funções para mapear
  const { data: funcoesCompletas = [] } = useQuery({
    queryKey: ['funcoes-completas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcoes')
        .select('id, nome_funcao, valor_diaria, valor_diaria_exclusiva, valor_refeicao')
        .eq('situacao', 'Ativo');
      return data || [];
    },
    enabled: showAddFuncionario
  });

  // Gerar lista de datas do período: passadas e hoje habilitadas, futuras bloqueadas
  const datasDisponiveis = useMemo(() => {
    if (!solicitacao?.data_inicio || !solicitacao?.data_fim) return [];

    const hoje = getCurrentBrazilianDate();
    const inicio = parseBrazilianDate(solicitacao.data_inicio);
    const fim = parseBrazilianDate(solicitacao.data_fim);
    const hojeDate = parseBrazilianDate(hoje);

    const dias = eachDayOfInterval({ start: inicio, end: fim });

    return dias.map(dia => {
      const dateStr = format(dia, 'yyyy-MM-dd');
      const feriado = feriados.find(f => f.data === dateStr);
      const ehFDS = isWeekend(dia);
      const isFuturo = isAfter(startOfDay(dia), startOfDay(hojeDate));
      const isHoje = dateStr === hoje;

      return {
        value: dateStr,
        label: format(dia, "EEE dd/MM", { locale: ptBR }),
        labelFull: format(dia, "EEEE, dd/MM/yyyy", { locale: ptBR }),
        isFeriado: !!feriado,
        nomeFeriado: feriado?.nome,
        isWeekend: ehFDS,
        isFuturo,
        isHoje,
        disabled: isFuturo
      };
    });
  }, [solicitacao?.data_inicio, solicitacao?.data_fim, feriados]);

  // Data selecionada info
  const dataSelecionadaInfo = useMemo(() => {
    return datasDisponiveis.find(d => d.value === selectedDate) || null;
  }, [datasDisponiveis, selectedDate]);

  // Parsear convocados_pre
  const convocadosPre = useMemo((): FuncionarioPreConvocado[] => {
    if (!solicitacao?.convocados_pre) return [];
    if (Array.isArray(solicitacao.convocados_pre)) {
      return solicitacao.convocados_pre as FuncionarioPreConvocado[];
    }
    return [];
  }, [solicitacao?.convocados_pre]);

  // Buscar matricula e cpf dos funcionários para o PDF
  const funcionarioIds = useMemo(() => convocadosPre.map(c => c.funcionario_id), [convocadosPre]);
  const { data: funcionariosData = [] } = useQuery({
    queryKey: ['funcionarios-matricula-cpf', funcionarioIds],
    queryFn: async () => {
      if (funcionarioIds.length === 0) return [];
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, matricula, cpf')
        .in('id', funcionarioIds);
      return data || [];
    },
    enabled: funcionarioIds.length > 0
  });

  const [isPrinting, setIsPrinting] = useState(false);

  const handleImprimirLista = async () => {
    if (!solicitacao || !centroCusto || !selectedDate) return;
    setIsPrinting(true);
    try {
      const itens: ListaPresencaItem[] = convocadosPre.map(conv => {
        const func = funcionariosData.find(f => f.id === conv.funcionario_id);
        const colab = colaboradores.find(c => c.funcionario_id === conv.funcionario_id);
        return {
          nome_completo: func?.nome_completo || conv.nome_funcionario || '',
          matricula: func?.matricula || null,
          cpf: func?.cpf || '',
          hora_entrada: colab?.hora_entrada || '',
          hora_saida: colab?.hora_saida || '',
        };
      });
      const ccLabel = `${centroCusto.codigo_centro_custo} - ${centroCusto.nome_centro_custo}`;
      const fileName = `Lista_Presenca_${solicitacao.numero_solicitacao}_${selectedDate}`;
      await generateListaPresencaPDF(solicitacao.numero_solicitacao, ccLabel, selectedDate, itens, fileName);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF da lista de presença.');
    } finally {
      setIsPrinting(false);
    }
  };

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
            const dateSel = parseBrazilianDate(selectedDate);
            const isDomingo = dateSel.getDay() === 0;
            const isFeriado = feriados.some(f => f.data === selectedDate);
            // Respeitar flag usar_diaria_exclusiva do convocado_pre
            const usarExclusiva = conv.usar_diaria_exclusiva === true || isDomingo || isFeriado;

            const vNormal = conv.valor_diaria;
            const vExclusiva = conv.valor_diaria_exclusiva || conv.valor_diaria;
            // Se existente, detectar se o valor salvo corresponde à exclusiva
            const existenteUsaExclusiva = existente
              ? (existente.valor_diaria_aplicada !== undefined && vExclusiva !== vNormal
                  ? Math.abs((existente.valor_diaria_aplicada || 0) - vExclusiva) < Math.abs((existente.valor_diaria_aplicada || 0) - vNormal)
                  : usarExclusiva)
              : usarExclusiva;
            const valorOriginal = existenteUsaExclusiva ? vExclusiva : vNormal;

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
              valor_refeicao_aplicado: existente?.valor_refeicao_aplicado ?? 0,
              presencaId: existente?.id,
              usarDiariaExclusiva: existenteUsaExclusiva,
              valor_diaria_normal: vNormal,
              valor_diaria_exclusiva_valor: vExclusiva
            };
          });
          setColaboradores(mapped);
          setFase(determinarFase(mapped, true));
        } else {
          setHasExistingData(false);
          const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
            const dateSel2 = parseBrazilianDate(selectedDate);
            const isDomingo2 = dateSel2.getDay() === 0;
            const isFeriado2 = feriados.some(f => f.data === selectedDate);
            // Respeitar flag usar_diaria_exclusiva do convocado_pre
            const usarExclusiva2 = conv.usar_diaria_exclusiva === true || isDomingo2 || isFeriado2;

            const vNormal = conv.valor_diaria;
            const vExclusiva = conv.valor_diaria_exclusiva || conv.valor_diaria;
            const valorOriginal = usarExclusiva2 ? vExclusiva : vNormal;
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
              valor_refeicao_aplicado: 0,
              usarDiariaExclusiva: usarExclusiva2,
              valor_diaria_normal: vNormal,
              valor_diaria_exclusiva_valor: vExclusiva
            };
          });
          setColaboradores(mapped);
          setFase('inicio');
        }
      } catch (error) {
        console.error("Erro ao carregar presenças:", error);
      const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
          const vNormal = conv.valor_diaria;
          const vExclusiva = conv.valor_diaria_exclusiva || conv.valor_diaria;
          return {
            index,
            funcionario_id: conv.funcionario_id,
            nome_funcionario: conv.nome_funcionario || "",
            funcao_id: conv.funcao_id,
            nome_funcao: conv.nome_funcao,
            valor_diaria_original: vExclusiva,
            valor_diaria: vExclusiva,
            presente: false,
            hora_entrada: "",
            hora_saida: "",
            tipo_diaria: 'completa',
            recebe_refeicao: true,
            valor_refeicao_aplicado: 0,
            usarDiariaExclusiva: true,
            valor_diaria_normal: vNormal,
            valor_diaria_exclusiva_valor: vExclusiva
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
    if (isOpen && datasDisponiveis.length > 0) {
      // Priorizar initialDate quando fornecida (ex: clique em badge com Liberado)
      if (initialDate && datasDisponiveis.some(d => d.value === initialDate)) {
        setSelectedDate(initialDate);
      } else {
        const hoje = getCurrentBrazilianDate();
        const hojeDisponivel = datasDisponiveis.find(d => d.value === hoje && !d.disabled);
        if (hojeDisponivel) {
          setSelectedDate(hojeDisponivel.value);
        } else {
          const passadas = datasDisponiveis.filter(d => !d.disabled);
          if (passadas.length > 0) {
            setSelectedDate(passadas[passadas.length - 1].value);
          }
        }
      }
    } else if (!isOpen) {
      setSelectedDate("");
      setColaboradores([]);
      setHasExistingData(false);
      setHasSaved(false);
      setFase('inicio');
      setEditingExitId(null);
      setShowAddFuncionario(false);
      setSaidasSalvas(new Set());
      setIsSavingIndividual(null);
      setObservacaoCorrecao("");
      setFuncionariosAvulsos(new Set());
      setFaltaConvertida(new Set());
      autoFinalizadoRef.current.clear();
    }
  }, [isOpen, datasDisponiveis, initialDate]);

  // Recalcular jornada ao mudar horários
  const recalcularJornada = useCallback((col: ColaboradorPresenca): ColaboradorPresenca => {
    if (!col.presente) {
      return { ...col, tipo_diaria: 'nenhuma', valor_diaria: 0 };
    }
    const { tipo } = calcularJornada(col.hora_entrada, col.hora_saida);
    const novoValor = calcularValorDiaria(col.valor_diaria_original, tipo);
    return { ...col, tipo_diaria: tipo, valor_diaria: novoValor };
  }, []);

  // Auto-finalização para sábados, domingos e feriados
  const autoFinalizarFdsEFeriado = useCallback(async (pendentes: ColaboradorPresenca[]) => {
    if (!solicitacao?.id || !selectedDate) return;

    // Atualizar state visual com hora_saida 16:00
    setColaboradores(prev => prev.map(col => {
      if (!pendentes.find(p => p.funcionario_id === col.funcionario_id)) return col;
      const updated = { ...col, hora_saida: '16:00' };
      return recalcularJornada(updated);
    }));

    setIsSaving(true);
    try {
      const registros: FinalizacaoFormData[] = pendentes.map(col => {
        const { tipo } = calcularJornada(col.hora_entrada, '16:00');
        const valorFinal = calcularValorDiaria(col.valor_diaria_original, tipo);
        return {
          funcionario_id: col.funcionario_id,
          hora_saida: '16:00',
          tipo_diaria: tipo,
          valor_diaria_aplicada: valorFinal,
          recebe_refeicao: col.recebe_refeicao ?? true,
          valor_refeicao_aplicado: col.recebe_refeicao ? (funcoesMap[col.funcao_id] || 0) : 0
        };
      });

      await salvarFinalizacao(solicitacao.id, selectedDate, registros);
      setHasSaved(true);
      setFase('concluido');
      toast.success(`Saída automática (16:00) aplicada para ${pendentes.length} funcionário(s).`);
      onSaveSuccess?.();
    } catch (error) {
      console.error('Erro na auto-finalização:', error);
      toast.error('Erro na auto-finalização. Tente novamente.');
      autoFinalizadoRef.current.delete(selectedDate);
    } finally {
      setIsSaving(false);
    }
  }, [solicitacao?.id, selectedDate, recalcularJornada, funcoesMap, onSaveSuccess]);

  // useEffect para disparar auto-finalização em FDS/feriado
  useEffect(() => {
    if (fase !== 'finalizacao' || readOnly || !selectedDate || isLoadingExisting) return;
    if (autoFinalizadoRef.current.has(selectedDate)) return;

    const dateSel = parseBrazilianDate(selectedDate);
    const isSab = dateSel.getDay() === 6;
    const isDom = dateSel.getDay() === 0;
    const isFer = feriados.some(f => f.data === selectedDate);

    if (!isSab && !isDom && !isFer) return;

    const pendentes = colaboradores.filter(
      c => c.presente && c.hora_entrada && !c.hora_saida && c.presencaId
    );
    if (pendentes.length === 0) return;

    autoFinalizadoRef.current.add(selectedDate);
    autoFinalizarFdsEFeriado(pendentes);
  }, [fase, selectedDate, colaboradores, feriados, readOnly, isLoadingExisting, autoFinalizarFdsEFeriado]);

  // Handlers
  const handlePresencaChange = (index: number, presente: boolean) => {
    if (readOnly) return;
    // Permitir marcar presença na finalização para atrasados (sem presencaId OU com presencaId mas era falta)
    if (fase !== 'inicio' && !(fase === 'concluido' && edicaoLiberada)) {
      const col = colaboradores.find(c => c.index === index);
      if (fase === 'finalizacao' && col) {
        // Permitir se não tem presencaId (avulso atrasado)
        // OU se tem presencaId mas está como falta (presente=false) e quer marcar como presente
        if (!col.presencaId && !presente) {
          // Desmarcando um avulso sem registro - OK
        } else if (col.presencaId && col.presente) {
          // Já está presente e tem registro - bloquear desmarcação na finalização
          return;
        }
        // Caso contrário, permitir (atrasado com ou sem presencaId)
      } else if (fase !== 'finalizacao') {
        return;
      }
    }
    setColaboradores((prev) =>
      prev.map((col) => {
        if (col.index !== index) return col;
        const horaAtual = format(new Date(), 'HH:mm');
        const updated = {
          ...col,
          presente,
          hora_entrada: presente && !col.hora_entrada ? horaAtual : col.hora_entrada,
          hora_saida: col.hora_saida,
          recebe_refeicao: presente ? col.recebe_refeicao : false
        };
        return recalcularJornada(updated);
      })
    );
    // Rastrear conversão falta→presente para funcionários com presencaId
    if (presente) {
      const col = colaboradores.find(c => c.index === index);
      if (col && col.presencaId && !col.presente) {
        setFaltaConvertida(prev => new Set(prev).add(col.funcionario_id));
      }
    } else {
      // Se desmarcou, remover do set
      const col = colaboradores.find(c => c.index === index);
      if (col) {
        setFaltaConvertida(prev => {
          const next = new Set(prev);
          next.delete(col.funcionario_id);
          return next;
        });
      }
    }
  };

  // MELHORIA 1: Selecionar/Desmarcar todos (inicio) + Saída Todos (finalizacao)
  const handleSelecionarTodos = (marcar: boolean) => {
    if (readOnly) return;
    const horaAtual = format(new Date(), 'HH:mm');

    if (fase === 'inicio' || (fase === 'concluido' && edicaoLiberada)) {
      setColaboradores((prev) =>
        prev.map((col) => {
          const updated = {
            ...col,
            presente: marcar,
            hora_entrada: marcar && !col.hora_entrada ? horaAtual : (marcar ? col.hora_entrada : col.hora_entrada),
            recebe_refeicao: marcar ? col.recebe_refeicao : false
          };
          return recalcularJornada(updated);
        })
      );
    } else if (fase === 'finalizacao') {
      // Na finalização: aplica/limpa hora_saida para todos os presentes não travados
      setColaboradores((prev) =>
        prev.map((col) => {
          if (!col.presente || saidasSalvas.has(col.funcionario_id)) return col;
          const updated = {
            ...col,
            hora_saida: marcar ? horaAtual : ''
          };
          return recalcularJornada(updated);
        })
      );
    }
  };

  const todosPresentes = colaboradores.length > 0 && colaboradores.every(c => c.presente);
  const todosComSaida = colaboradores.filter(c => c.presente && !saidasSalvas.has(c.funcionario_id)).every(c => !!c.hora_saida);

  // Alternar refeição de todos os presentes de uma vez
  const handleRefeicaoTodos = (recebe: boolean) => {
    if (fase === 'concluido' || readOnly) return;
    setColaboradores((prev) =>
      prev.map((col) => {
        if (!col.presente) return col;
        return { ...col, recebe_refeicao: recebe };
      })
    );
  };

  const todosComRefeicao = colaboradores.filter(c => c.presente).every(c => c.recebe_refeicao);

  // Salvar saída individual de um funcionário
  const handleSalvarSaidaIndividual = async (colaborador: ColaboradorPresenca) => {
    if (!solicitacao?.id || !selectedDate || !colaborador.hora_saida) return;

    const { excede12h } = calcularJornada(colaborador.hora_entrada, colaborador.hora_saida);
    if (excede12h) {
      toast.error(`Jornada acima de 12h não permitida para ${colaborador.nome_funcionario}.`);
      return;
    }

    setIsSavingIndividual(colaborador.funcionario_id);
    try {
      const { tipo } = calcularJornada(colaborador.hora_entrada, colaborador.hora_saida);
      const valorFinal = calcularValorDiaria(colaborador.valor_diaria_original, tipo);

      await salvarSaidaIndividual(solicitacao.id, selectedDate, {
        funcionario_id: colaborador.funcionario_id,
        hora_saida: colaborador.hora_saida,
        tipo_diaria: tipo,
        valor_diaria_aplicada: valorFinal,
        recebe_refeicao: colaborador.recebe_refeicao ?? true,
        valor_refeicao_aplicado: colaborador.recebe_refeicao ? (funcoesMap[colaborador.funcao_id] || 0) : 0
      });

      setSaidasSalvas(prev => new Set(prev).add(colaborador.funcionario_id));
      toast.success(`Saída de ${colaborador.nome_funcionario} salva!`);
    } catch (error: any) {
      console.error('Erro ao salvar saída individual:', error);
      toast.error(error.message || 'Erro ao salvar saída individual.');
    } finally {
      setIsSavingIndividual(null);
    }
  };

  // MELHORIA 2: Adicionar funcionário avulso
  const funcionariosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    const idsJaConvocados = convocadosPre.map(c => c.funcionario_id);
    return funcionariosAtivos
      .filter((f: any) => 
        !idsJaConvocados.includes(f.id) &&
        (f.nome_completo?.toLowerCase().includes(term) || f.cpf?.includes(term))
      )
      .slice(0, 10);
  }, [searchTerm, funcionariosAtivos, convocadosPre]);

  const handleAdicionarFuncionario = async (funcionario: any) => {
    if (!solicitacao?.id) return;
    setIsAddingFuncionario(true);
    try {
      // Verificar se está em outra solicitação
      const { emOutra, numeroSolicitacao } = await verificarFuncionarioEmOutraSolicitacao(
        funcionario.id,
        solicitacao.data_inicio,
        solicitacao.data_fim,
        solicitacao.id
      );

      if (emOutra) {
        toast.warning(
          `${funcionario.nome_completo} está na solicitação Nº ${numeroSolicitacao}. O solicitante precisa liberá-lo primeiro.`,
          { duration: 5000 }
        );
        setIsAddingFuncionario(false);
        return;
      }

      // Usar dados do RPC diretamente (funcao_nome, valor_diaria já vêm do RPC)
      const nomeFuncao = funcionario.funcao_nome || 'Sem função';
      const valorDiaria = funcionario.valor_diaria || 0;
      const funcao = funcoesCompletas.find(f => f.id === funcionario.funcao_id);
      const valorDiariaExclusiva = funcao?.valor_diaria_exclusiva || valorDiaria;

      const novoConvocado = {
        funcionario_id: funcionario.id,
        funcao_id: funcionario.funcao_id || '',
        valor_diaria: valorDiaria,
        valor_diaria_exclusiva: valorDiariaExclusiva,
        valor_refeicao: funcao?.valor_refeicao || funcionario.valor_refeicao || 0,
        nome_funcionario: funcionario.nome_completo,
        nome_funcao: nomeFuncao
      };

      await adicionarFuncionarioConvocado(solicitacao.id, novoConvocado);

      // Adicionar ao state local
      const dateSel = parseBrazilianDate(selectedDate);
      const isDomingo = dateSel.getDay() === 0;
      const isFeriado = feriados.some(f => f.data === selectedDate);
      const usarExclusiva = isDomingo || isFeriado;
      const valorOriginal = usarExclusiva ? valorDiariaExclusiva : valorDiaria;

      const novoColab: ColaboradorPresenca = {
        index: colaboradores.length,
        funcionario_id: funcionario.id,
        nome_funcionario: funcionario.nome_completo,
        funcao_id: funcionario.funcao_id || '',
        nome_funcao: nomeFuncao,
        valor_diaria_original: valorOriginal,
        valor_diaria: valorOriginal,
        presente: false,
        hora_entrada: "",
        hora_saida: "",
        tipo_diaria: 'completa',
        recebe_refeicao: true,
        valor_refeicao_aplicado: 0,
        usarDiariaExclusiva: usarExclusiva,
        valor_diaria_normal: valorDiaria,
        valor_diaria_exclusiva_valor: valorDiariaExclusiva
      };

      setColaboradores(prev => [...prev, novoColab]);
      setFuncionariosAvulsos(prev => new Set(prev).add(funcionario.id));
      // Invalidar queries para atualizar a solicitação
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });

      toast.success(`${funcionario.nome_completo} adicionado à lista de convocados.`);
      setSearchTerm("");
      setShowAddFuncionario(false);
    } catch (error: any) {
      console.error('Erro ao adicionar funcionário:', error);
      toast.error(error.message || 'Erro ao adicionar funcionário.');
    } finally {
      setIsAddingFuncionario(false);
    }
  };

  // Handler para remover/liberar funcionário da lista
  const handleRemoverFuncionario = async (funcionarioId: string, nomeFuncionario: string) => {
    if (!solicitacao?.id) return;
    try {
      await removerFuncionarioConvocado(solicitacao.id, funcionarioId);
      setColaboradores(prev => prev.filter(c => c.funcionario_id !== funcionarioId));
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });
      toast.success(`${nomeFuncionario} liberado da lista.`);
    } catch (error: any) {
      console.error('Erro ao liberar funcionário:', error);
      toast.error(error.message || 'Erro ao liberar funcionário.');
    }
  };

  // MELHORIA 3: Editar hora de saída pós-conclusão
  const handleStartEditExit = (colaborador: ColaboradorPresenca) => {
    setEditingExitId(colaborador.funcionario_id);
    setEditExitTime(colaborador.hora_saida || "");
    setEditJustificativa("");
  };

  const handleCancelEditExit = () => {
    setEditingExitId(null);
    setEditExitTime("");
    setEditJustificativa("");
  };

  const handleSaveEditExit = async (colaborador: ColaboradorPresenca) => {
    if (!editJustificativa.trim()) {
      toast.error('Justificativa é obrigatória para editar hora de saída.');
      return;
    }
    if (!editExitTime) {
      toast.error('Informe a nova hora de saída.');
      return;
    }
    if (!colaborador.presencaId) {
      toast.error('Registro de presença não encontrado.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const engenheiroId = (solicitacao as any)?.engenheiro_solicitante_id || null;
      await editarHoraSaida(
        colaborador.presencaId,
        editExitTime,
        editJustificativa,
        engenheiroId
      );

      // Atualizar state local
      setColaboradores(prev => prev.map(col => {
        if (col.funcionario_id !== colaborador.funcionario_id) return col;
        const updated = { ...col, hora_saida: editExitTime };
        return recalcularJornada(updated);
      }));

      toast.success('Hora de saída atualizada com sucesso!');
      handleCancelEditExit();
      onSaveSuccess?.();
    } catch (error: any) {
      console.error('Erro ao editar saída:', error);
      toast.error(error.message || 'Erro ao editar hora de saída.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleHorarioChange = (
    index: number,
    field: "hora_entrada" | "hora_saida",
    value: string
  ) => {
    if (readOnly) return;
    if (fase === 'inicio' && field === 'hora_saida') return;
    // hora_entrada editável na finalização (período de treinamento)
    if (fase === 'concluido' && !edicaoLiberada) return;

    setColaboradores((prev) =>
      prev.map((col) => {
        if (col.index !== index) return col;
        if (!col.presente) return col;
        const updated = { ...col, [field]: value };
        return recalcularJornada(updated);
      })
    );
  };

  const handleRefeicaoChange = (index: number, recebe: boolean) => {
    if ((fase === 'concluido' && !edicaoLiberada) || readOnly) return;
    setColaboradores((prev) =>
      prev.map((col) =>
        col.index === index ? { ...col, recebe_refeicao: recebe } : col
      )
    );
  };

  // Toggle tipo de diária (Normal vs FDS/Feriado) por funcionário
  const handleTipoDiariaChange = (index: number, usarExclusiva: boolean) => {
    if (readOnly) return;
    if (fase === 'concluido' && !edicaoLiberada) return;
    setColaboradores((prev) =>
      prev.map((col) => {
        if (col.index !== index) return col;
        const novoValorOriginal = usarExclusiva ? col.valor_diaria_exclusiva_valor : col.valor_diaria_normal;
        const updated = { ...col, usarDiariaExclusiva: usarExclusiva, valor_diaria_original: novoValorOriginal };
        return recalcularJornada(updated);
      })
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
        valor_diaria_original: col.valor_diaria_original,
        usar_diaria_exclusiva: col.usarDiariaExclusiva
      }));

      await salvarInicio(solicitacao.id, selectedDate, registros);
      
      // Persistir motivo da edição quando edicaoLiberada
      if (edicaoLiberada && isSuperAdmin && observacaoCorrecao.trim() && apontamento?.id) {
        await supabase
          .from('bd_diaria_apontamentos')
          .update({ observacoes: observacaoCorrecao.trim() })
          .eq('id', apontamento.id);
      }
      
      setHasSaved(true);
      setFase('finalizacao');
      setHasExistingData(true);
      toast.success('Início do apontamento salvo com sucesso!');
      onSaveSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar início:", error);
      toast.error('Erro ao salvar início do apontamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Salvar Início de Atrasados (durante fase de finalização)
  const handleSalvarInicioAtrasados = async () => {
    if (!solicitacao?.id || !selectedDate) return;

    // Atrasados sem presencaId (avulsos novos)
    const atrasadosSemId = colaboradores.filter(c => c.presente && !c.presencaId);
    // Atrasados com presencaId (eram falta, agora presente)
    const atrasadosConvertidos = colaboradores.filter(c => c.presente && c.presencaId && faltaConvertida.has(c.funcionario_id));
    
    if (atrasadosSemId.length === 0 && atrasadosConvertidos.length === 0) return;

    setIsSaving(true);
    try {
      // INSERT para avulsos sem registro
      if (atrasadosSemId.length > 0) {
        const registros: InicioFormData[] = atrasadosSemId.map(col => ({
          funcionario_id: col.funcionario_id,
          funcao_id: col.funcao_id,
          presente: col.presente,
          hora_entrada: col.hora_entrada || undefined,
          valor_diaria_original: col.valor_diaria_original,
          usar_diaria_exclusiva: col.usarDiariaExclusiva
        }));
        await salvarInicioParcial(solicitacao.id, selectedDate, registros);
      }

      // UPDATE para quem era falta e agora é presente
      if (atrasadosConvertidos.length > 0) {
        const registrosUpdate = atrasadosConvertidos.map(col => ({
          id: col.presencaId!,
          hora_entrada: col.hora_entrada || format(new Date(), 'HH:mm'),
          valor_diaria_original: col.valor_diaria_original,
          usar_diaria_exclusiva: col.usarDiariaExclusiva
        }));
        await atualizarFaltaParaPresente(registrosUpdate);
      }
      
      // Recarregar presenças para obter os IDs dos registros criados
      const existentes = await getPresencasPorSolicitacao(solicitacao.id, selectedDate);
      setColaboradores(prev => prev.map(col => {
        const existente = existentes.find(e => e.funcionario_id === col.funcionario_id);
        if (existente) {
          return { ...col, presencaId: existente.id, presente: existente.presente || col.presente };
        }
        return col;
      }));

      // Limpar o set de conversões
      setFaltaConvertida(new Set());

      const totalAtrasados = atrasadosSemId.length + atrasadosConvertidos.length;
      toast.success(`Entrada de ${totalAtrasados} atrasado(s) registrada!`);
      onSaveSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar início dos atrasados:", error);
      toast.error(error.message || 'Erro ao salvar entrada dos atrasados.');
    } finally {
      setIsSaving(false);
    }
  };

  // Salvar Finalização
  const handleSalvarFinalizacao = async () => {
    if (!solicitacao?.id || !selectedDate) return;

    const presentes = colaboradores.filter(c => c.presente);
    const excedem12h = presentes.filter(col => {
      const { excede12h } = calcularJornada(col.hora_entrada, col.hora_saida);
      return excede12h;
    });

    if (excedem12h.length > 0) {
      const nomes = excedem12h.map(c => c.nome_funcionario).join(', ');
      toast.error(`Jornada acima de 12h não permitida: ${nomes}. Corrija os horários antes de finalizar.`);
      return;
    }

    setIsSaving(true);
    try {
      // Filtrar apenas os que ainda não tiveram saída salva individualmente
      const pendentes = presentes.filter(c => !saidasSalvas.has(c.funcionario_id));
      const registros: FinalizacaoFormData[] = pendentes.map(col => {
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
  // Salvar Correção (edicaoLiberada)
  const handleSalvarCorrecao = async () => {
    if (!solicitacao?.id || !selectedDate || !observacaoCorrecao.trim()) return;

    setIsSaving(true);
    try {
      const registros: CorrecaoFormData[] = colaboradores.map(col => {
        const { tipo } = calcularJornada(col.hora_entrada, col.hora_saida);
        const valorFinal = col.presente ? calcularValorDiaria(col.valor_diaria_original, tipo) : 0;
        return {
          funcionario_id: col.funcionario_id,
          presente: col.presente,
          hora_entrada: col.hora_entrada || '',
          hora_saida: col.hora_saida || '',
          tipo_diaria: col.presente ? tipo : 'nenhuma',
          valor_diaria_aplicada: valorFinal,
          recebe_refeicao: col.recebe_refeicao ?? true,
          valor_refeicao_aplicado: col.recebe_refeicao ? (funcoesMap[col.funcao_id] || 0) : 0
        };
      });

      await salvarCorrecao(solicitacao.id, selectedDate, registros, observacaoCorrecao);
      toast.success('Correção salva com sucesso!');
      setObservacaoCorrecao("");
      onSaveSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar correção:", error);
      toast.error('Erro ao salvar correção.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPresentes = colaboradores.filter((c) => c.presente).length;
  if (!apontamento || !solicitacao) return null;

  const faseLabel = {
    inicio: { text: 'Registrar Entrada', color: 'text-blue-600' },
    finalizacao: { text: 'Registrar Saída', color: 'text-orange-600' },
    concluido: { text: 'Concluído', color: 'text-green-600' }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <span className="truncate">Apontamento de Diária</span>
            {solicitacao?.numero_solicitacao && (
              <Badge variant="outline" className="font-mono text-[10px] sm:text-xs shrink-0">
                Nº {solicitacao.numero_solicitacao}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {readOnly 
              ? "Visualização somente leitura."
              : "Registre presença e horários dos funcionários"}
          </DialogDescription>
        </DialogHeader>

        {/* Informações da Solicitação */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Período</p>
                <p className="font-medium text-xs sm:text-sm">
                  {formatBrazilianDateForDisplay(solicitacao.data_inicio)} → {formatBrazilianDateForDisplay(solicitacao.data_fim)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Centro de Custo</p>
                <p className="font-medium text-xs sm:text-sm">
                  <span>{centroCusto?.codigo_centro_custo}</span>
                  <span className="hidden sm:inline"> - {centroCusto?.nome_centro_custo}</span>
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Data do Apontamento - Seletor de datas do período */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Data do Apontamento
            </Label>

            {datasDisponiveis.filter(d => !d.disabled).length > 0 ? (
              <>
                {/* Seletor de datas como badges clicáveis */}
                <div className="flex gap-1.5 p-2 sm:p-3 bg-muted rounded-md border overflow-x-auto scrollbar-thin">
                  {datasDisponiveis.map(d => {
                    const isSelected = d.value === selectedDate;
                    return (
                      <button
                        key={d.value}
                        onClick={() => { if (!d.disabled) { setSelectedDate(d.value); setHasSaved(false); setSaidasSalvas(new Set()); } }}
                        disabled={d.disabled}
                        className={cn(
                          "px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all border whitespace-nowrap shrink-0",
                          d.disabled
                            ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground border-transparent"
                            : isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background hover:bg-accent text-foreground border-border cursor-pointer",
                          d.isHoje && !isSelected && !d.disabled && "ring-1 ring-primary/50"
                        )}
                      >
                        <span className="capitalize">{d.label}</span>
                        {d.isWeekend && <span className="ml-0.5 opacity-70">●</span>}
                        {d.isFeriado && <span className="ml-0.5 text-amber-500">★</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Info da data selecionada */}
                {dataSelecionadaInfo && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                    <span className="capitalize font-medium">{dataSelecionadaInfo.labelFull}</span>
                    {dataSelecionadaInfo.isWeekend && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">FDS</Badge>
                    )}
                    {dataSelecionadaInfo.isFeriado && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs text-amber-600">
                        {dataSelecionadaInfo.nomeFeriado}
                      </Badge>
                    )}
                    {dataSelecionadaInfo.isHoje && (
                      <Badge variant="info" className="text-[10px] sm:text-xs">Hoje</Badge>
                    )}
                    <Badge
                      variant={fase === 'concluido' ? 'success' : fase === 'finalizacao' ? 'warning' : 'secondary'}
                      className="ml-auto text-[10px] sm:text-xs"
                    >
                      {faseLabel[fase].text}
                    </Badge>
                  </div>
                )}

                {dataSelecionadaInfo && (dataSelecionadaInfo.isWeekend || dataSelecionadaInfo.isFeriado) && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {dataSelecionadaInfo.isFeriado
                        ? `Feriado: ${dataSelecionadaInfo.nomeFeriado}`
                        : "Final de semana"}
                    </AlertDescription>
                  </Alert>
                )}

                {fase === 'finalizacao' && (
                  <>
                    <Alert className="mt-2 bg-orange-50 text-orange-800 border-orange-200">
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Início já registrado. Preencha a hora de saída e refeição para finalizar.
                      </AlertDescription>
                    </Alert>

                    {/* Toggle compacto de refeição em massa */}
                    <div className="mt-3 flex items-center gap-3 p-2 bg-muted rounded-md border">
                      <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Refeição Todos</span>
                      <Switch
                        checked={todosComRefeicao}
                        onCheckedChange={(checked) => handleRefeicaoTodos(checked)}
                      />
                    </div>
                  </>
                )}

                {fase === 'concluido' && (
                  <Alert className="mt-2 bg-green-50 text-green-800 border-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Apontamento finalizado. Você pode editar apenas a hora de saída com justificativa.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma data disponível para apontamento. O período desta solicitação ainda não começou.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Banner edição liberada + observação obrigatória */}
          {edicaoLiberada && isSuperAdmin && (
            <div className="space-y-2">
              <Alert className="border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs">
                  Edição liberada pelo administrador — os campos estão desbloqueados para correção.
                </AlertDescription>
              </Alert>
              <div>
                <Label className="text-xs font-medium text-destructive">Motivo da edição *</Label>
                <Textarea
                  placeholder="Descreva o motivo da correção... (obrigatório)"
                  value={observacaoCorrecao}
                  onChange={(e) => setObservacaoCorrecao(e.target.value)}
                  className="text-xs min-h-[60px] mt-1"
                />
                {!observacaoCorrecao.trim() && (
                  <p className="text-[10px] text-destructive mt-1">Campo obrigatório para salvar alterações.</p>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Lista de Funcionários */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-medium">Funcionários ({colaboradores.length})</h3>
                
                {fase === 'inicio' && !readOnly && colaboradores.length > 0 && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleSelecionarTodos(!todosPresentes)}
                    className="text-[10px] sm:text-xs gap-1 h-6 sm:h-7 px-2"
                  >
                    {todosPresentes ? <><Square className="h-3 w-3" /><span className="hidden sm:inline">Desmarcar</span> Todos</> : <><CheckSquare className="h-3 w-3" /><span className="hidden sm:inline">Selecionar</span> Todos</>}
                  </Button>
                )}
                {fase === 'finalizacao' && !readOnly && colaboradores.filter(c => c.presente).length > 0 && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleSelecionarTodos(!todosComSaida)}
                    className="text-[10px] sm:text-xs gap-1 h-6 sm:h-7 px-2"
                  >
                    {todosComSaida ? <><Square className="h-3 w-3" />Limpar</> : <><CheckSquare className="h-3 w-3" />Saída Todos</>}
                  </Button>
                )}

                {(fase === 'inicio' || fase === 'finalizacao') && !readOnly && (
                  <Popover open={showAddFuncionario} onOpenChange={setShowAddFuncionario}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="xs" className="text-[10px] sm:text-xs gap-1 h-6 sm:h-7 px-2">
                        <Plus className="h-3 w-3" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] sm:w-[350px] p-3" align="start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar por nome ou CPF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                          />
                        </div>
                        {searchTerm.trim() && (
                          <ScrollArea className="max-h-[200px]">
                            {funcionariosFiltrados.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                Nenhum funcionário encontrado
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {funcionariosFiltrados.map((func: any) => (
                                  <button
                                    key={func.id}
                                    onClick={() => handleAdicionarFuncionario(func)}
                                    disabled={isAddingFuncionario}
                                    className="w-full text-left p-2 rounded hover:bg-muted text-sm flex items-center justify-between"
                                  >
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">{func.nome_completo}</p>
                                      <p className="text-[10px] sm:text-xs text-muted-foreground">{func.funcao_nome || func.nome_funcao || 'Sem função'}</p>
                                    </div>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground flex items-center gap-2 sm:gap-3">
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
              <ScrollArea className="h-[300px] sm:h-[350px] border rounded-md p-2 sm:p-4">
                <div className="space-y-3 sm:space-y-4">
                  {colaboradores.map((colaborador) => {
                    const { horas, tipo } = calcularJornada(colaborador.hora_entrada, colaborador.hora_saida);
                    const valorRefeicao = funcoesMap[colaborador.funcao_id] || 0;

                    const presencaDisabled = readOnly || (fase === 'concluido' && !edicaoLiberada) || (fase === 'finalizacao' && !!colaborador.presencaId && colaborador.presente && !faltaConvertida.has(colaborador.funcionario_id)) || (fase !== 'inicio' && fase !== 'finalizacao' && !(fase === 'concluido' && edicaoLiberada));
                    const isAtrasado = fase === 'finalizacao' && colaborador.presente && (!colaborador.presencaId || faltaConvertida.has(colaborador.funcionario_id));
                    const entradaDisabled = (fase !== 'inicio' && fase !== 'finalizacao' && !(fase === 'concluido' && edicaoLiberada)) || !colaborador.presente || readOnly || (isAtrasado && !isSuperAdmin);
                    const jaSalvouSaida = saidasSalvas.has(colaborador.funcionario_id);
                    const saidaDisabled = (fase !== 'finalizacao' && !(fase === 'concluido' && edicaoLiberada)) || !colaborador.presente || readOnly || jaSalvouSaida;
                    const refeicaoDisabled = (fase === 'concluido' && !edicaoLiberada) || !colaborador.presente || readOnly || jaSalvouSaida;
                    const isEditingThis = editingExitId === colaborador.funcionario_id;

                    return (
                      <div
                        key={colaborador.funcionario_id}
                        className={cn(
                          "p-2.5 sm:p-4 rounded-md shadow-sm border",
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
                        {/* Linha 1: Checkbox + Nome + Badges */}
                        <div className="flex items-start gap-2 mb-2">
                          <Checkbox
                            id={`presente-${colaborador.funcionario_id}`}
                            checked={colaborador.presente}
                            onCheckedChange={(checked) =>
                              handlePresencaChange(colaborador.index, !!checked)
                            }
                            disabled={presencaDisabled}
                            className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs sm:text-sm truncate">{colaborador.nome_funcionario}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {fase === 'concluido' && colaborador.presente ? (
                                  <>
                                    {getBadgeJornada(tipo, horas)}
                                    <Badge variant="success" className="text-[10px] sm:text-xs hidden sm:flex items-center gap-1">
                                      <Lock className="h-2.5 w-2.5" /> Finalizado
                                    </Badge>
                                    <Lock className="h-3 w-3 text-green-600 sm:hidden" />
                                    {!readOnly && colaborador.presencaId && (
                                      <Button variant="ghost" size="xs" onClick={() => handleStartEditExit(colaborador)} className="h-5 w-5 sm:h-6 sm:w-6 p-0">
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                ) : colaborador.presente ? (
                                  colaborador.hora_saida ? getBadgeJornada(tipo, horas) : <Badge variant="warning" className="text-[10px] sm:text-xs">Em andamento</Badge>
                                ) : (
                                  <>
                                    <Badge variant="destructive" className="text-[10px] sm:text-xs">Falta</Badge>
                                    {fase === 'inicio' && !readOnly && (
                                      <Button variant="ghost" size="xs" onClick={() => handleRemoverFuncionario(colaborador.funcionario_id, colaborador.nome_funcionario)} className="h-5 w-5 p-0 text-destructive hover:text-destructive">
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{colaborador.nome_funcao}</p>
                          </div>
                        </div>

                        {/* Linha 2: Entrada + Saída lado a lado */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 hidden sm:block" />
                            <div className="flex-1 relative">
                              <label className="text-[10px] text-muted-foreground block mb-0.5 sm:hidden">Entrada</label>
                              <Input
                                type="time"
                                value={colaborador.hora_entrada || ""}
                                onChange={(e) => handleHorarioChange(colaborador.index, "hora_entrada", e.target.value)}
                                disabled={entradaDisabled}
                                className={cn("h-7 sm:h-9 text-xs sm:text-sm", entradaDisabled ? "opacity-50" : "")}
                                placeholder="Entrada"
                              />
                            </div>
                            {fase === 'concluido' && colaborador.hora_entrada && (
                              <Lock className="h-3 w-3 text-muted-foreground shrink-0 hidden sm:block" />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 hidden sm:block" />
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground block mb-0.5 sm:hidden">Saída</label>
                              <Input
                                type="time"
                                value={colaborador.hora_saida || ""}
                                onChange={(e) => handleHorarioChange(colaborador.index, "hora_saida", e.target.value)}
                                disabled={saidaDisabled}
                                className={cn("h-7 sm:h-9 text-xs sm:text-sm", saidaDisabled && fase !== 'finalizacao' ? "opacity-50" : "")}
                                placeholder="Saída"
                              />
                            </div>
                            {fase === 'concluido' && colaborador.hora_saida && (
                              <Lock className="h-3 w-3 text-muted-foreground shrink-0 hidden sm:block" />
                            )}
                            {jaSalvouSaida && fase === 'finalizacao' && (
                              <Lock className="h-3 w-3 text-green-600 shrink-0" title="Saída já salva" />
                            )}
                          </div>
                        </div>

                        {/* Botão Salvar Saída Individual */}
                        {fase === 'finalizacao' && colaborador.presente && colaborador.hora_saida && !jaSalvouSaida && !readOnly && (
                          <div className="mt-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleSalvarSaidaIndividual(colaborador)}
                              disabled={isSavingIndividual === colaborador.funcionario_id}
                              className="text-[10px] sm:text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 h-6 w-full sm:w-auto"
                            >
                              {isSavingIndividual === colaborador.funcionario_id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Salvar Saída
                            </Button>
                          </div>
                        )}

                        {/* Toggle Refeição compacto */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
                          <div className="flex items-center gap-1.5">
                            <UtensilsCrossed className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            <Label htmlFor={`refeicao-${colaborador.funcionario_id}`} className="text-xs sm:text-sm cursor-pointer">
                              Refeição
                            </Label>
                            {colaborador.presente && colaborador.recebe_refeicao && valorRefeicao > 0 && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground">
                                (R$ {valorRefeicao.toFixed(2)})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              id={`refeicao-${colaborador.funcionario_id}`}
                              checked={!!colaborador.recebe_refeicao}
                              onCheckedChange={(checked) => handleRefeicaoChange(colaborador.index, checked)}
                              disabled={refeicaoDisabled}
                            />
                            {fase === 'concluido' && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Toggle Tipo Diária: Normal vs FDS/Feriado — só para avulsos */}
                        {colaborador.valor_diaria_normal !== colaborador.valor_diaria_exclusiva_valor && funcionariosAvulsos.has(colaborador.funcionario_id) && (
                          <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                              <Label htmlFor={`tipo-diaria-${colaborador.funcionario_id}`} className="text-xs sm:text-sm cursor-pointer">
                                Diária Especial
                              </Label>
                              <Badge variant={colaborador.usarDiariaExclusiva ? "warning" : "secondary"} className="text-[10px]">
                                {colaborador.usarDiariaExclusiva
                                  ? `R$ ${colaborador.valor_diaria_exclusiva_valor.toFixed(2)}`
                                  : `R$ ${colaborador.valor_diaria_normal.toFixed(2)}`}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                id={`tipo-diaria-${colaborador.funcionario_id}`}
                                checked={colaborador.usarDiariaExclusiva}
                                onCheckedChange={(checked) => handleTipoDiariaChange(colaborador.index, checked)}
                                disabled={(fase === 'concluido' && !edicaoLiberada) || !colaborador.presente || readOnly || jaSalvouSaida}
                              />
                              {fase === 'concluido' && !edicaoLiberada && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </div>
                        )}

                        {isEditingThis && (
                          <div className="mt-3 pt-3 border-t border-dashed space-y-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                            <p className="text-xs font-medium flex items-center gap-1 text-yellow-700">
                              <AlertTriangle className="h-3 w-3" />
                              Edição pós-conclusão — justificativa obrigatória
                            </p>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs whitespace-nowrap">Nova saída:</Label>
                              <Input
                                type="time"
                                value={editExitTime}
                                onChange={(e) => setEditExitTime(e.target.value)}
                                className="h-8 w-32 text-sm"
                              />
                            </div>
                            <Textarea
                              placeholder="Justificativa para alteração da hora de saída..."
                              value={editJustificativa}
                              onChange={(e) => setEditJustificativa(e.target.value)}
                              className="text-sm h-16 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={handleCancelEditExit}
                                disabled={isSavingEdit}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                              <Button
                                size="xs"
                                onClick={() => handleSaveEditExit(colaborador)}
                                disabled={isSavingEdit || !editJustificativa.trim() || !editExitTime}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white"
                              >
                                {isSavingEdit ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                Salvar
                              </Button>
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

        <DialogFooter className="sm:justify-between flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-10">
              {fase === 'concluido' || readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleImprimirLista}
              disabled={isPrinting || !selectedDate || convocadosPre.length === 0}
              className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-10"
            >
              {isPrinting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 mr-1.5" />}
              <span className="hidden sm:inline">Imprimir Lista</span>
              <span className="sm:hidden">Imprimir</span>
            </Button>
          </div>

          {fase === 'inicio' && !readOnly && (
            <Button
              onClick={handleSalvarInicio}
              disabled={isSaving || hasSaved || !selectedDate || colaboradores.length === 0 || (edicaoLiberada && isSuperAdmin && !observacaoCorrecao.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
            >
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Clock className="h-3.5 w-3.5 mr-1.5" />Salvar Início</>}
            </Button>
          )}

          {fase === 'finalizacao' && !readOnly && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Botão para salvar início de atrasados */}
              {(colaboradores.some(c => c.presente && !c.presencaId) || faltaConvertida.size > 0) && (
                <Button
                  onClick={handleSalvarInicioAtrasados}
                  disabled={isSaving || !selectedDate || (edicaoLiberada && isSuperAdmin && !observacaoCorrecao.trim())}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
                >
                  {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Clock className="h-3.5 w-3.5 mr-1.5" />Salvar Início (Atrasados)</>}
                </Button>
              )}
              {/* Botão de finalização normal */}
              {!colaboradores.some(c => c.presente && !c.presencaId) && faltaConvertida.size === 0 && (
                <Button
                  onClick={handleSalvarFinalizacao}
                  disabled={isSaving || !selectedDate || colaboradores.length === 0 || !colaboradores.filter(c => c.presente && !!c.presencaId).every(c => c.hora_saida) || (edicaoLiberada && isSuperAdmin && !observacaoCorrecao.trim())}
                  className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
                >
                  {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Finalizando...</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Salvar Finalização</>}
                </Button>
              )}
            </div>
          )}

          {fase === 'concluido' && !edicaoLiberada && (
            <Badge variant="success" className="text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-1.5 justify-center w-full sm:w-auto">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Concluído
            </Badge>
          )}

          {fase === 'concluido' && edicaoLiberada && !readOnly && (
            <Button
              onClick={handleSalvarCorrecao}
              disabled={isSaving || !selectedDate || colaboradores.length === 0 || !observacaoCorrecao.trim()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
            >
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5 mr-1.5" />Salvar Correção</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
