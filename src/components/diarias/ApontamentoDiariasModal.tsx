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
  salvarFinalizacao,
  salvarSaidaIndividual,
  editarHoraSaida,
  type PresencaFormData,
  type TipoDiaria,
  type InicioFormData,
  type FinalizacaoFormData
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
}

interface ColaboradorPresenca extends PresencaFormData {
  index: number;
  presencaId?: string; // ID da presença no banco para edição pós-conclusão
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
  readOnly = false
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
  
   // Estado para saídas salvas individualmente
  const [saidasSalvas, setSaidasSalvas] = useState<Set<string>>(new Set());
  const [isSavingIndividual, setIsSavingIndividual] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
            const usarExclusiva = isDomingo || isFeriado;

            const valorOriginal = usarExclusiva
              ? (conv.valor_diaria_exclusiva || conv.valor_diaria)
              : conv.valor_diaria;
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
              presencaId: existente?.id
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
            const usarExclusiva2 = isDomingo2 || isFeriado2;

            const valorOriginal = usarExclusiva2
              ? (conv.valor_diaria_exclusiva || conv.valor_diaria)
              : conv.valor_diaria;
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
      setEditingExitId(null);
      setShowAddFuncionario(false);
      setSaidasSalvas(new Set());
      setIsSavingIndividual(null);
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
    if ((fase !== 'inicio' && fase !== 'finalizacao') || readOnly) return;
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

  // MELHORIA 1: Selecionar/Desmarcar todos (inicio) + Saída Todos (finalizacao)
  const handleSelecionarTodos = (marcar: boolean) => {
    if (readOnly) return;
    const horaAtual = format(new Date(), 'HH:mm');

    if (fase === 'inicio') {
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
        valor_refeicao_aplicado: 0
      };

      setColaboradores(prev => [...prev, novoColab]);
      
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
    if (fase === 'finalizacao' && field === 'hora_entrada') return;
    if (fase === 'concluido') return;

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
    if (fase === 'concluido' || readOnly) return;
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
      onClose();
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
            {readOnly 
              ? "Visualização somente leitura — você não tem permissão para editar este apontamento."
              : "Registre a presença e horários dos funcionários para esta data"}
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
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Funcionários ({colaboradores.length})</h3>
                
                {/* MELHORIA 1: Botões Selecionar/Desmarcar Todos (inicio) + Saída Todos (finalizacao) */}
                {fase === 'inicio' && !readOnly && colaboradores.length > 0 && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleSelecionarTodos(!todosPresentes)}
                    className="text-xs gap-1"
                  >
                    {todosPresentes ? (
                      <>
                        <Square className="h-3 w-3" />
                        Desmarcar Todos
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3 w-3" />
                        Selecionar Todos
                      </>
                    )}
                  </Button>
                )}
                {fase === 'finalizacao' && !readOnly && colaboradores.filter(c => c.presente).length > 0 && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleSelecionarTodos(!todosComSaida)}
                    className="text-xs gap-1"
                  >
                    {todosComSaida ? (
                      <>
                        <Square className="h-3 w-3" />
                        Limpar Saída Todos
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3 w-3" />
                        Saída Todos (agora)
                      </>
                    )}
                  </Button>
                )}

                {/* MELHORIA 2: Botão Adicionar Funcionário */}
                {(fase === 'inicio' || fase === 'finalizacao') && !readOnly && (
                  <Popover open={showAddFuncionario} onOpenChange={setShowAddFuncionario}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="xs" className="text-xs gap-1">
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-3" align="start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar funcionário por nome ou CPF..."
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
                                      <p className="font-medium">{func.nome_completo}</p>
                                      <p className="text-xs text-muted-foreground">{func.funcao_nome || func.nome_funcao || 'Sem função'}</p>
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

                    const presencaDisabled = fase !== 'inicio' || readOnly;
                    const entradaDisabled = fase !== 'inicio' || !colaborador.presente || readOnly;
                    const jaSalvouSaida = saidasSalvas.has(colaborador.funcionario_id);
                    const saidaDisabled = fase !== 'finalizacao' || !colaborador.presente || readOnly || jaSalvouSaida;
                    const refeicaoDisabled = fase === 'concluido' || !colaborador.presente || readOnly || jaSalvouSaida;
                    const isEditingThis = editingExitId === colaborador.funcionario_id;

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
                                {/* MELHORIA 3: Botão editar saída pós-conclusão */}
                                {!readOnly && colaborador.presencaId && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => handleStartEditExit(colaborador)}
                                    className="h-6 w-6 p-0"
                                    title="Editar hora de saída"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </>
                            ) : colaborador.presente ? (
                              colaborador.hora_saida
                                ? getBadgeJornada(tipo, horas)
                                : <Badge variant="warning" className="text-xs">Em andamento</Badge>
                            ) : (
                              <>
                                <Badge variant="destructive" className="text-xs">Falta</Badge>
                                {fase === 'inicio' && !readOnly && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => handleRemoverFuncionario(colaborador.funcionario_id, colaborador.nome_funcionario)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    title="Liberar funcionário da lista"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
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
                            {jaSalvouSaida && fase === 'finalizacao' && (
                              <Lock className="h-3 w-3 text-green-600 flex-shrink-0" title="Saída já salva" />
                            )}
                            {/* Botão Salvar Saída Individual */}
                            {fase === 'finalizacao' && colaborador.presente && colaborador.hora_saida && !jaSalvouSaida && !readOnly && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleSalvarSaidaIndividual(colaborador)}
                                disabled={isSavingIndividual === colaborador.funcionario_id}
                                className="text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                              >
                                {isSavingIndividual === colaborador.funcionario_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3" />
                                )}
                                Salvar
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Linha 3: Toggle Refeição */}
                        {(
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

                        {/* MELHORIA 3: Formulário inline de edição de hora de saída */}
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

        <DialogFooter className="sm:justify-between flex-col sm:flex-row gap-3 mt-6 pt-4 border-t">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {fase === 'concluido' || readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleImprimirLista}
              disabled={isPrinting || !selectedDate || convocadosPre.length === 0}
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Imprimir Lista
            </Button>
          </div>

          {fase === 'inicio' && !readOnly && (
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

          {fase === 'finalizacao' && !readOnly && (
            <Button
              onClick={handleSalvarFinalizacao}
              disabled={isSaving || !dataHoje || colaboradores.length === 0 || !colaboradores.filter(c => c.presente).every(c => c.hora_saida)}
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
