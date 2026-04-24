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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  X,
  Moon,
  Send,
  RefreshCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import type { DiariaApontamento, FuncionarioPreConvocado } from "@/types/diarias";
import {
  getPresencasPorSolicitacao,
  salvarInicio,
  salvarInicioParcial,
  inserirPresencasCompletas,
  atualizarFaltaParaPresente,
  salvarFinalizacao,
  salvarSaidaIndividual,
  salvarCorrecao,
  editarHoraSaida,
  type PresencaFormData,
  type TipoDiaria,
  type TurnoDiaria,
  type InicioFormData,
  type FinalizacaoFormData,
  type CorrecaoFormData,
  type ResultadoInsercaoIdempotente
} from "@/services/diarias/presencasService";
import {
  adicionarFuncionarioConvocado,
  removerFuncionarioConvocado,
  verificarFuncionarioEmOutraSolicitacao,
  updateSolicitacao
} from "@/services/diarias/solicitacoesService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateListaPresencaPDF } from "@/services/pdfService";
import type { ListaPresencaItem } from "@/components/diarias/pdf/ListaPresencaPDF";
import {
  resolverRegraOperacional,
  salvarRegraCalendarioOperacional,
  inativarRegraCalendarioOperacionalEscopo,
  registrarLogOperacionalData,
  type CalendarioOperacionalResolvido,
} from "@/services/diarias/calendarioOperacionalService";
import { solicitarInclusaoFuncionario, listarInclusoesPendentes } from "@/services/diarias/inclusaoFuncionarioService";
import { useAuth } from "@/hooks/useAuth";
import type { RegrasOperacionaisSnapshot, RegraOperacionalSnapshotItem } from "@/types/diarias";

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
  turno: TurnoDiaria; // Turno: diurno ou noturno
  statusExcecao?: 'pendente_aprovacao' | null;
  remessaLiberada?: boolean;
  diariaExclusivaOperacional?: boolean;
  observacaoOperacional?: string | null;
  tipoDiaOperacional?: string | null;
  pendenciaInclusaoId?: string;
}

interface FuncionarioBuscaItem {
  id: string;
  nome_completo: string;
  cpf?: string | null;
  matricula?: string | null;
  centro_custo_id?: string | null;
  centro_custo_codigo?: string | null;
  centro_custo_nome?: string | null;
  funcao_id?: string | null;
  funcao_nome?: string | null;
  valor_diaria?: number | null;
  valor_refeicao?: number | null;
  bd_funcoes?: {
    id: string;
    nome_funcao?: string | null;
    valor_diaria?: number | null;
    valor_diaria_exclusiva?: number | null;
    valor_refeicao?: number | null;
  } | null;
  _alocacao?: {
    codigo_centro_custo?: string | null;
    numero_solicitacao?: string | null;
  } | null;
}

type ClassificacaoOperacional =
  | {
      status: 'elegivel';
      regra: CalendarioOperacionalResolvido;
      mensagem?: string;
    }
  | {
      status: 'pendente_aprovacao';
      regra: CalendarioOperacionalResolvido;
      mensagem: string;
    }
  | {
      status: 'ignorado';
      regra: CalendarioOperacionalResolvido;
      mensagem: string;
    };

type FaseApontamento = 'inicio' | 'finalizacao' | 'concluido';
type TipoDiaManual = 'normal' | 'feriado' | 'ponte';

const TIPO_DIA_LABEL: Record<TipoDiaManual, string> = {
  normal: 'Normal',
  feriado: 'Feriado',
  ponte: 'Ponte',
};

// Calcula horas trabalhadas e tipo de diária
function calcularJornada(entrada: string | undefined, saida: string | undefined): { horas: number; tipo: TipoDiaria; excede12h: boolean } {
  if (!entrada || !saida) return { horas: 0, tipo: 'nenhuma', excede12h: false };

  const [hE, mE] = entrada.split(':').map(Number);
  const [hS, mS] = saida.split(':').map(Number);
  
  let totalMinutos = (hS * 60 + mS) - (hE * 60 + mE);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  
  const horasBrutas = totalMinutos / 60;
  // Descontar 1h de almoço se jornada bruta > 6h
  const horas = horasBrutas > 6 ? horasBrutas - 1 : horasBrutas;

  if (horasBrutas > 12) return { horas: horasBrutas, tipo: 'uma_e_meia', excede12h: true };
  if (horas >= 9.75) return { horas, tipo: 'uma_e_meia', excede12h: false }; // >= 9:45
  if (horas >= 4.5) return { horas, tipo: 'completa', excede12h: false };    // >= 4:30
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

function montarMensagemInsercao(
  resultado: ResultadoInsercaoIdempotente,
  labels?: {
    singularInserido?: string;
    pluralInserido?: string;
    nenhumInserido?: string;
    singularIgnorado?: string;
    pluralIgnorado?: string;
  }
): string {
  const {
    singularInserido = 'funcionário adicionado com sucesso',
    pluralInserido = 'funcionários adicionados com sucesso',
    nenhumInserido = 'Nenhum novo funcionário foi adicionado',
    singularIgnorado = 'já estava apontado e foi ignorado',
    pluralIgnorado = 'já estavam apontados e foram ignorados',
  } = labels ?? {};

  const linhas: string[] = [];

  if (resultado.inseridos > 0) {
    linhas.push(
      `${resultado.inseridos} ${resultado.inseridos === 1 ? singularInserido : pluralInserido}`
    );
  } else if (resultado.ignorados > 0) {
    linhas.push(nenhumInserido);
  }

  if (resultado.ignorados > 0) {
    linhas.push(
      `${resultado.ignorados} ${resultado.ignorados === 1 ? singularIgnorado : pluralIgnorado}`
    );
  }

  return linhas.join('\n');
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
  const [hasValidatedDateStructure, setHasValidatedDateStructure] = useState(false);
  const [colaboradores, setColaboradores] = useState<ColaboradorPresenca[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [fase, setFase] = useState<FaseApontamento>('inicio');
  
  // Estado para adicionar funcionário avulso
  const [showAddFuncionario, setShowAddFuncionario] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Filtro local da lista de colaboradores já carregados (nome / cpf / função)
  const [filtroColaboradores, setFiltroColaboradores] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isAddingFuncionario, setIsAddingFuncionario] = useState(false);
  const [selectedFuncionariosIds, setSelectedFuncionariosIds] = useState<Set<string>>(new Set());
  const [searchPage, setSearchPage] = useState(0);
  const [searchPageSize] = useState(20);
  const [isAddingAllCentroCusto, setIsAddingAllCentroCusto] = useState(false);
  const [isSendingApproval, setIsSendingApproval] = useState(false);
  const [regrasOperacionaisPorData, setRegrasOperacionaisPorData] = useState<Record<string, CalendarioOperacionalResolvido>>({});
  const [tiposDiaSaving, setTiposDiaSaving] = useState<Record<string, boolean>>({});
  const [regraPopoverData, setRegraPopoverData] = useState<string | null>(null);
  const [descricaoRegraOperacional, setDescricaoRegraOperacional] = useState("");
  const [regraExigeAprovacao, setRegraExigeAprovacao] = useState(false);
  const [isSavingRegraOperacional, setIsSavingRegraOperacional] = useState(false);
  
  // Estado para confirmação de adição com justificativa + férias
  const [addSelectedFunc, setAddSelectedFunc] = useState<any>(null);
  const [addJustificativa, setAddJustificativa] = useState("");
  const [addFerias, setAddFerias] = useState(false);
  
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
  // Ref para controle de auto-finalização (evita duplicação)
  const autoFinalizadoRef = useRef<Set<string>>(new Set());
  
  // Estado para conflito de transferência entre solicitações
  const [transferConflict, setTransferConflict] = useState<{
    funcionario: any;
    outraSolicitacaoId: string;
    numeroSolicitacao: string;
  } | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Estado para confirmação de liberação de funcionário
  const [releaseConfirm, setReleaseConfirm] = useState<{
    funcionarioId: string;
    nomeFuncionario: string;
    hasPresenca?: boolean;
  } | null>(null);
  const [releaseJustificativa, setReleaseJustificativa] = useState('');

  const queryClient = useQueryClient();
  const { userId } = useAuth();

  // Extrair dados da solicitação
  const solicitacao = apontamento?.bd_diaria_solicitacoes;
  const centroCusto = solicitacao?.bd_centros_custo;
  const diretoriaId = (centroCusto as any)?.diretoria_id ?? null;
  const escopoRegraAtual = useMemo(() => (
    centroCusto?.id
      ? { escopo_tipo: 'centro_custo' as const, escopo_id: centroCusto.id }
      : diretoriaId
        ? { escopo_tipo: 'diretoria' as const, escopo_id: diretoriaId }
        : { escopo_tipo: 'global' as const, escopo_id: null }
  ), [centroCusto?.id, diretoriaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setSearchPage(0);
  }, [debouncedSearchTerm]);

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

  // Busca GLOBAL de funcionários ativos (sem filtro de CC/escopo).
  // Conflitos operacionais (alocação em outra solicitação, fora do CC, etc.)
  // são tratados como aviso APÓS seleção, não como filtro.
  const { data: funcionariosAtivos = [], isFetching: isSearchingFuncionarios } = useQuery({
    queryKey: ['funcionarios-ativos-diarias-global', showAddFuncionario],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;

      while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('bd_funcionarios')
          .select(`
            id,
            nome_completo,
            cpf,
            funcao_id,
            centro_custo_id,
            matricula,
            status,
            banco,
            agencia,
            conta_corrente,
            chave_pix,
            bd_funcoes(id, nome_funcao, valor_diaria, valor_diaria_exclusiva, valor_refeicao)
          `)
          .eq('status', 'Ativo')
          .order('nome_completo', { ascending: true })
          .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }

      // Normaliza para o shape esperado pelo SmartFuncionarioSearch.
      return allData.map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        cpf: f.cpf,
        funcao_id: f.funcao_id,
        centro_custo_id: f.centro_custo_id,
        matricula: f.matricula,
        status_funcionario: f.status,
        banco: f.banco,
        agencia: f.agencia,
        conta_corrente: f.conta_corrente,
        chave_pix: f.chave_pix,
        funcao_nome: f.bd_funcoes?.nome_funcao ?? null,
        valor_diaria: f.bd_funcoes?.valor_diaria ?? 0,
        valor_diaria_exclusiva: f.bd_funcoes?.valor_diaria_exclusiva ?? null,
        valor_refeicao: f.bd_funcoes?.valor_refeicao ?? 0,
      })) as FuncionarioBuscaItem[];
    },
    enabled: showAddFuncionario,
  });

  const { data: pendenciasInclusao = [] } = useQuery({
    queryKey: ['inclusoes-pendentes-apontamento', solicitacao?.id],
    queryFn: () => listarInclusoesPendentes(solicitacao?.id),
    enabled: isOpen && !!solicitacao?.id,
  });

  const universoBusca = funcionariosAtivos as FuncionarioBuscaItem[];
  const idsJaPresentes = useMemo(() => new Set(colaboradores.map(c => c.funcionario_id)), [colaboradores]);
  const termoBuscaNormalizado = debouncedSearchTerm.trim().toLowerCase();
  const buscaPorCentroCustoAtual = useMemo(() => {
    if (!termoBuscaNormalizado) return false;
    const codigo = centroCusto?.codigo_centro_custo?.toLowerCase() || '';
    const nome = centroCusto?.nome_centro_custo?.toLowerCase() || '';
    return termoBuscaNormalizado === codigo || nome.includes(termoBuscaNormalizado);
  }, [termoBuscaNormalizado, centroCusto?.codigo_centro_custo, centroCusto?.nome_centro_custo]);

  // Buscar funções para mapear (sempre ativo para cruzar valores atuais)
  const { data: funcoesCompletas = [] } = useQuery({
    queryKey: ['funcoes-completas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcoes')
        .select('id, nome_funcao, valor_diaria, valor_diaria_exclusiva, valor_refeicao');
      return data || [];
    },
    enabled: isOpen
  });

  // Mapa de CPFs dos colaboradores carregados — usado apenas para filtro local da lista
  const colaboradoresIds = useMemo(() => colaboradores.map(c => c.funcionario_id), [colaboradores]);
  const { data: cpfMap = {} } = useQuery({
    queryKey: ['apontamento-colaboradores-cpf', colaboradoresIds.sort().join(',')],
    queryFn: async () => {
      if (colaboradoresIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, cpf')
        .in('id', colaboradoresIds);
      const map: Record<string, string> = {};
      (data || []).forEach((f: any) => { if (f?.id) map[f.id] = f.cpf || ''; });
      return map;
    },
    enabled: isOpen && colaboradoresIds.length > 0,
    staleTime: 60_000,
  });
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
    const info = datasDisponiveis.find(d => d.value === selectedDate) || null;
    if (!info) return null;
    return {
      ...info,
      regraOperacional: regrasOperacionaisPorData[selectedDate] || null,
    };
  }, [datasDisponiveis, selectedDate, regrasOperacionaisPorData]);

  const datasSelecionaveis = useMemo(
    () => datasDisponiveis.filter((d) => !d.disabled),
    [datasDisponiveis]
  );

  const possuiSnapshotEstruturado = useMemo(() => {
    const snapshotDatas = (solicitacao as any)?.regras_operacionais_snapshot?.datas;
    return !!snapshotDatas && typeof snapshotDatas === 'object' && Object.keys(snapshotDatas).length > 0;
  }, [solicitacao]);

  const possuiEstruturaDatas = datasSelecionaveis.length > 0 || possuiSnapshotEstruturado;
  const datasEstruturadasCarregadas = !!solicitacao?.id && hasValidatedDateStructure;
  const legacyMode = useMemo(
    () => Boolean(isOpen && datasEstruturadasCarregadas && !possuiEstruturaDatas && !selectedDate),
    [isOpen, datasEstruturadasCarregadas, possuiEstruturaDatas, selectedDate]
  );
  const legacyPresenceActionsDisabled = legacyMode;

  const regraOperacionalFallback = useMemo<CalendarioOperacionalResolvido>(() => ({
    encontrada: false,
    disponivel: false,
    regra: null,
    permiteRemessaMatriculados: true,
    usaDiariaExclusiva: false,
    exigeAprovacaoAdicao: false,
    tipoDiaOperacional: null,
    descricao: 'Solicitação legada sem controle diário.',
  }), []);

  const snapshotOperacionalBase = useMemo<RegrasOperacionaisSnapshot>(() => {
    const raw = (solicitacao as any)?.regras_operacionais_snapshot;
    return {
      datas: raw?.datas && typeof raw.datas === 'object' ? raw.datas : {},
      observacao: raw?.observacao ?? '',
      classificacao: 'feriado_ponte_operacional',
    };
  }, [solicitacao]);

  const [regrasOperacionaisSnapshotLocal, setRegrasOperacionaisSnapshotLocal] = useState<RegrasOperacionaisSnapshot>(snapshotOperacionalBase);

  useEffect(() => {
    setRegrasOperacionaisSnapshotLocal(snapshotOperacionalBase);
  }, [snapshotOperacionalBase]);

  const getSnapshotTipoDia = useCallback((data: string): RegraOperacionalSnapshotItem | null => {
    return regrasOperacionaisSnapshotLocal.datas?.[data] ?? null;
  }, [regrasOperacionaisSnapshotLocal]);

  const resolveTipoDiaManual = useCallback((data: string): TipoDiaManual | null => {
    const item = getSnapshotTipoDia(data);
    return item?.tipo_dia ?? null;
  }, [getSnapshotTipoDia]);

  const aplicarOverrideSolicitacaoNaRegra = useCallback((data: string, regraBase?: CalendarioOperacionalResolvido | null): CalendarioOperacionalResolvido => {
    const snapshotItem = getSnapshotTipoDia(data);
    const base = regraBase ?? regrasOperacionaisPorData[data] ?? {
      encontrada: false,
      disponivel: true,
      regra: null,
      permiteRemessaMatriculados: false,
      usaDiariaExclusiva: false,
      exigeAprovacaoAdicao: false,
      tipoDiaOperacional: null,
      descricao: null,
    };

    if (!snapshotItem?.ativa || !snapshotItem.tipo_dia) return base;

    if (snapshotItem.tipo_dia === 'normal') {
      return {
        ...base,
        encontrada: true,
        tipoDiaOperacional: 'normal',
        permiteRemessaMatriculados: false,
        usaDiariaExclusiva: false,
        exigeAprovacaoAdicao: false,
        descricao: snapshotItem.descricao || 'Tipo do dia definido manualmente na solicitação: normal.',
      };
    }

    if (snapshotItem.tipo_dia === 'feriado') {
      return {
        ...base,
        encontrada: true,
        tipoDiaOperacional: 'feriado_estrategico',
        permiteRemessaMatriculados: true,
        usaDiariaExclusiva: true,
        exigeAprovacaoAdicao: false,
        descricao: snapshotItem.descricao || 'Tipo do dia definido manualmente na solicitação: feriado.',
      };
    }

    // Ponte: equivalente operacional ao feriado para fins de inclusão de funcionários
    // matriculados (permite remessa sem exigir aprovação extra).
    return {
      ...base,
      encontrada: true,
      tipoDiaOperacional: 'operacional',
      permiteRemessaMatriculados: true,
      usaDiariaExclusiva: true,
      exigeAprovacaoAdicao: false,
      descricao: snapshotItem.descricao || 'Tipo do dia definido manualmente na solicitação: ponte.',
    };
  }, [getSnapshotTipoDia, regrasOperacionaisPorData]);

  const getTipoDiaBadge = useCallback((data: string, info?: { isFeriado?: boolean; isWeekend?: boolean; nomeFeriado?: string | null }) => {
    const manual = resolveTipoDiaManual(data);
    if (manual) {
      return {
        label: TIPO_DIA_LABEL[manual],
        variant: manual === 'normal' ? 'secondary' : manual === 'feriado' ? 'outline' : 'info',
        descricao: manual === 'feriado'
          ? 'Feriado manual salvo na solicitação'
          : manual === 'ponte'
            ? 'Ponte manual salva na solicitação'
            : 'Normal manual salvo na solicitação',
        manual: true,
      } as const;
    }

    if (info?.isFeriado) {
      return { label: info.nomeFeriado || 'Feriado', variant: 'outline', descricao: 'Feriado do calendário', manual: false } as const;
    }

    if (info?.isWeekend) {
      return { label: 'FDS', variant: 'secondary', descricao: 'Final de semana', manual: false } as const;
    }

    return { label: 'Normal', variant: 'secondary', descricao: 'Dia normal', manual: false } as const;
  }, [resolveTipoDiaManual]);

  // Parsear convocados_pre
  const convocadosPre = useMemo((): FuncionarioPreConvocado[] => {
    if (!solicitacao?.convocados_pre) return [];
    if (Array.isArray(solicitacao.convocados_pre)) {
      return solicitacao.convocados_pre as FuncionarioPreConvocado[];
    }
    return [];
  }, [solicitacao?.convocados_pre]);
  const idsJaConvocados = useMemo(() => new Set(convocadosPre.map(c => c.funcionario_id)), [convocadosPre]);

  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!isOpen || datasDisponiveis.length === 0) return;

    let cancelled = false;
    const carregarRegras = async () => {
      const entries = await Promise.all(
        datasDisponiveis
          .filter((d) => !d.disabled)
          .map(async (dataItem) => [
            dataItem.value,
            await resolverRegraOperacional({
              data: dataItem.value,
              centroCustoId: centroCusto?.id,
              diretoriaId,
            }),
          ] as const)
      );

      if (cancelled) return;
      setRegrasOperacionaisPorData(
        Object.fromEntries(entries.map(([data, regra]) => [data, aplicarOverrideSolicitacaoNaRegra(data, regra)]))
      );
    };

    carregarRegras();
    return () => {
      cancelled = true;
    };
  }, [isOpen, datasDisponiveis, centroCusto?.id, diretoriaId, aplicarOverrideSolicitacaoNaRegra]);

  const buildColaboradorFromFuncionario = useCallback((funcionario: FuncionarioBuscaItem, overrides?: Partial<ColaboradorPresenca>): ColaboradorPresenca => {
    const funcao = funcoesCompletas.find(f => f.id === funcionario.funcao_id) as any;
    const valorDiaria = funcao?.valor_diaria ?? funcionario.valor_diaria ?? 0;
    const valorDiariaExclusiva = funcao?.valor_diaria_exclusiva ?? funcionario.bd_funcoes?.valor_diaria_exclusiva ?? valorDiaria;
    const regra = selectedDate ? aplicarOverrideSolicitacaoNaRegra(selectedDate) : undefined;
    const dateSel = selectedDate ? parseBrazilianDate(selectedDate) : null;
    const usarExclusivaPorData = !!dateSel && (dateSel.getDay() === 0 || dateSel.getDay() === 6 || feriados.some(f => f.data === selectedDate));
    const usarExclusiva = regra?.usaDiariaExclusiva || usarExclusivaPorData || !!overrides?.usarDiariaExclusiva;
    const nomeFuncao = funcionario.funcao_nome || funcionario.bd_funcoes?.nome_funcao || 'Sem função';

    return {
      index: colaboradores.length,
      funcionario_id: funcionario.id,
      nome_funcionario: funcionario.nome_completo,
      funcao_id: funcionario.funcao_id || '',
      nome_funcao: nomeFuncao,
      valor_diaria_original: usarExclusiva ? valorDiariaExclusiva : valorDiaria,
      valor_diaria: usarExclusiva ? valorDiariaExclusiva : valorDiaria,
      presente: false,
      hora_entrada: '',
      hora_saida: '',
      tipo_diaria: 'completa',
      recebe_refeicao: true,
      valor_refeicao_aplicado: 0,
      usarDiariaExclusiva: usarExclusiva,
      valor_diaria_normal: valorDiaria,
      valor_diaria_exclusiva_valor: valorDiariaExclusiva,
      turno: 'diurno',
      remessaLiberada: regra?.permiteRemessaMatriculados ?? false,
      diariaExclusivaOperacional: regra?.usaDiariaExclusiva ?? false,
      tipoDiaOperacional: regra?.tipoDiaOperacional ?? null,
      observacaoOperacional: regra?.descricao ?? null,
      ...overrides,
    };
  }, [funcoesCompletas, aplicarOverrideSolicitacaoNaRegra, selectedDate, feriados, colaboradores.length]);

  const resultadosBusca = useMemo(() => {
    if (!debouncedSearchTerm) return [] as FuncionarioBuscaItem[];

    const filtrarElegiveis = (items: FuncionarioBuscaItem[]) => items.filter((func) => {
      const jaEstaNaTela = idsJaPresentes.has(func.id);
      const jaConvocado = idsJaConvocados.has(func.id);
      return !jaEstaNaTela && !jaConvocado;
    });

    const term = termoBuscaNormalizado;
    return filtrarElegiveis(universoBusca)
      .filter((func) => {
        if (buscaPorCentroCustoAtual) return true;
        return (
          func.nome_completo?.toLowerCase().includes(term) ||
          func.cpf?.includes(term) ||
          func.matricula?.toLowerCase().includes(term) ||
          func.centro_custo_codigo?.toLowerCase().includes(term) ||
          func.centro_custo_nome?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));
  }, [debouncedSearchTerm, idsJaConvocados, idsJaPresentes, universoBusca, termoBuscaNormalizado, buscaPorCentroCustoAtual]);

  const totalResultadosBusca = resultadosBusca.length;
  const resultadosBuscaPaginados = useMemo(() => {
    const from = searchPage * searchPageSize;
    const to = from + searchPageSize;
    return resultadosBusca.slice(from, to);
  }, [resultadosBusca, searchPage, searchPageSize]);

  const modalReady = legacyMode || (!!selectedDate && datasDisponiveis.length > 0);

  const pendentesLocais = useMemo(
    () => colaboradores.filter((col) => col.statusExcecao === 'pendente_aprovacao' && !col.pendenciaInclusaoId),
    [colaboradores]
  );

  const getPreviewOperacional = useCallback((funcionario: FuncionarioBuscaItem) => {
    const regra = selectedDate ? aplicarOverrideSolicitacaoNaRegra(selectedDate) : regraOperacionalFallback;
    const temMatricula = !!funcionario.matricula;
    const exigeAprovacao = !!regra?.exigeAprovacaoAdicao;
    const remessaPermitida = !!regra?.permiteRemessaMatriculados;
    const excecaoOperacional = temMatricula && exigeAprovacao;

    return {
      remessaPermitida: temMatricula && remessaPermitida,
      requerAprovacao: excecaoOperacional,
      excecaoOperacional,
      regra,
    };
  }, [aplicarOverrideSolicitacaoNaRegra, selectedDate, regraOperacionalFallback]);

  const sincronizarRegraOperacionalData = useCallback(async (data: string) => {
    const resolvida = await resolverRegraOperacional({
      data,
      centroCustoId: centroCusto?.id,
      diretoriaId,
    });

    setRegrasOperacionaisPorData((prev) => ({
      ...prev,
      [data]: aplicarOverrideSolicitacaoNaRegra(data, resolvida),
    }));

    return aplicarOverrideSolicitacaoNaRegra(data, resolvida);
  }, [centroCusto?.id, diretoriaId, aplicarOverrideSolicitacaoNaRegra]);

  const abrirPopoverRegraOperacional = useCallback((data: string) => {
    const regraAtual = regrasOperacionaisPorData[data];
    setRegraPopoverData(data);
    setDescricaoRegraOperacional(regraAtual?.descricao ?? '');
    setRegraExigeAprovacao(!!regraAtual?.exigeAprovacaoAdicao);
  }, [regrasOperacionaisPorData]);

  const persistirTipoDiaSolicitacao = useCallback(async (data: string, tipoDia: TipoDiaManual) => {
    if (!solicitacao?.id) return;

    const snapshotAnterior = regrasOperacionaisSnapshotLocal;
    const regraAnterior = regrasOperacionaisPorData[data];
    const itemAnterior = snapshotAnterior.datas?.[data] ?? null;
    const proximoItem: RegraOperacionalSnapshotItem = {
      ativa: true,
      descricao: `Tipo do dia definido manualmente: ${TIPO_DIA_LABEL[tipoDia]}`,
      tipo: 'feriado_ponte_operacional',
      tipo_dia: tipoDia,
      exige_aprovacao_adicao: false,
    };
    const proximoSnapshot: RegrasOperacionaisSnapshot = {
      ...snapshotAnterior,
      datas: {
        ...snapshotAnterior.datas,
        [data]: proximoItem,
      },
    };
    const regraOtimista = aplicarOverrideSolicitacaoNaRegra(data, regraAnterior);

    setTiposDiaSaving((prev) => ({ ...prev, [data]: true }));
    setRegrasOperacionaisSnapshotLocal(proximoSnapshot);
    setRegrasOperacionaisPorData((prev) => ({
      ...prev,
      [data]: regraOtimista,
    }));

    try {
      const solicitacaoAtualizada = await updateSolicitacao(solicitacao.id, {
        regras_operacionais_por_data: proximoSnapshot,
      });

      const snapshotPersistido = (solicitacaoAtualizada.regras_operacionais_snapshot ?? proximoSnapshot) as RegrasOperacionaisSnapshot;

      // Verificação real de persistência: o snapshot retornado deve refletir o tipo solicitado
      const tipoPersistido = snapshotPersistido?.datas?.[data]?.tipo_dia;
      if (tipoPersistido !== tipoDia) {
        throw new Error(
          `Persistência divergente: esperado "${tipoDia}", recebido "${tipoPersistido ?? 'vazio'}". Verifique RLS/permissões.`
        );
      }

      setRegrasOperacionaisSnapshotLocal(snapshotPersistido);
      setRegrasOperacionaisPorData((prev) => ({
        ...prev,
        [data]: aplicarOverrideSolicitacaoNaRegra(data, prev[data]),
      }));

      // Sincroniza cache da listagem de apontamentos (fonte real do selectedApontamento na página pai)
      queryClient.setQueriesData({ queryKey: ['diaria-apontamentos'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((a: any) =>
          a?.bd_diaria_solicitacoes?.id === solicitacao.id
            ? {
                ...a,
                bd_diaria_solicitacoes: {
                  ...a.bd_diaria_solicitacoes,
                  regras_operacionais_snapshot: snapshotPersistido,
                },
              }
            : a
        );
      });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamento-solicitacao', solicitacao.id] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });
      toast.success(`Tipo do dia salvo: ${TIPO_DIA_LABEL[tipoDia]}.`);
    } catch (error: any) {
      const snapshotRevertido: RegrasOperacionaisSnapshot = {
        ...snapshotAnterior,
        datas: {
          ...snapshotAnterior.datas,
        },
      };

      if (itemAnterior) snapshotRevertido.datas[data] = itemAnterior;
      else delete snapshotRevertido.datas[data];

      setRegrasOperacionaisSnapshotLocal(snapshotRevertido);
      setRegrasOperacionaisPorData((prev) => ({
        ...prev,
        [data]: regraAnterior ?? aplicarOverrideSolicitacaoNaRegra(data, null),
      }));
      toast.error(error?.message || 'Não foi possível salvar o tipo do dia. Alteração desfeita.');
    } finally {
      setTiposDiaSaving((prev) => ({ ...prev, [data]: false }));
    }
  }, [solicitacao?.id, regrasOperacionaisSnapshotLocal, regrasOperacionaisPorData, aplicarOverrideSolicitacaoNaRegra, queryClient]);

  const salvarOverrideOperacional = useCallback(async (data: string) => {
    const descricao = descricaoRegraOperacional.trim();
    if (descricao.length < 5) {
      toast.error('A observação da regra precisa ter pelo menos 5 caracteres.');
      return;
    }

    setIsSavingRegraOperacional(true);
    try {
      await salvarRegraCalendarioOperacional({
        data,
        escopo_tipo: escopoRegraAtual.escopo_tipo,
        escopo_id: escopoRegraAtual.escopo_id,
        tipo_dia_operacional: 'operacional',
        permite_remessa_matriculados: true,
        usa_diaria_exclusiva: true,
        exige_aprovacao_adicao: regraExigeAprovacao,
        descricao,
        ativo: true,
      });

      await registrarLogOperacionalData({ data, acao: 'ativou', descricao });
      await sincronizarRegraOperacionalData(data);
      setRegraPopoverData(null);
      toast.success('Regra operacional aplicada ao dia.');
    } catch (error: any) {
      console.error('Erro ao salvar regra operacional:', error);
      toast.error(error.message || 'Erro ao salvar regra operacional.');
    } finally {
      setIsSavingRegraOperacional(false);
    }
  }, [descricaoRegraOperacional, escopoRegraAtual, regraExigeAprovacao, sincronizarRegraOperacionalData]);

  const desativarOverrideOperacional = useCallback(async (data: string) => {
    setIsSavingRegraOperacional(true);
    try {
      await inativarRegraCalendarioOperacionalEscopo({
        data,
        escopo_tipo: escopoRegraAtual.escopo_tipo,
        escopo_id: escopoRegraAtual.escopo_id,
      });
      await registrarLogOperacionalData({
        data,
        acao: 'desativou',
        descricao: regrasOperacionaisPorData[data]?.descricao ?? 'Regra operacional desativada manualmente.',
      });
      await sincronizarRegraOperacionalData(data);
      setRegraPopoverData(null);
      toast.success('Regra operacional removida do dia.');
    } catch (error: any) {
      console.error('Erro ao desativar regra operacional:', error);
      toast.error(error.message || 'Erro ao desativar regra operacional.');
    } finally {
      setIsSavingRegraOperacional(false);
    }
  }, [escopoRegraAtual, regrasOperacionaisPorData, sincronizarRegraOperacionalData]);

  // Normalizar nome para comparação (sem acento, lowercase, espaços únicos)
  const normalizeName = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleImprimirLista = async () => {
    if (!solicitacao || !centroCusto || !selectedDate) return;
    setIsPrinting(true);
    try {
      // 1. Buscar matricula/CPF por ID direto
      const ids = colaboradores.map(c => c.funcionario_id);
      const { data: funcsData } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, matricula, cpf')
        .in('id', ids);

      // 2. Identificar colaboradores sem match por ID
      const matchedIds = new Set((funcsData || []).map(f => f.id));
      const orphanColabs = colaboradores.filter(c => !matchedIds.has(c.funcionario_id));

      // 3. Para órfãos, buscar via RPC (SECURITY DEFINER) com fallback por nome
      let rpcFuncionarios: any[] = [];
      if (orphanColabs.length > 0) {
        const PAGE_SIZE = 1000;
        let page = 0;
        while (true) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          const { data } = await supabase.rpc('get_funcionarios_para_diarias').range(from, to);
          if (!data || data.length === 0) break;
          rpcFuncionarios = rpcFuncionarios.concat(data);
          if (data.length < PAGE_SIZE) break;
          page++;
        }
      }

      // Buscar snapshots do convocados_pre para fallback final
      const convocadosPreMap = new Map<string, FuncionarioPreConvocado>();
      convocadosPre.forEach(c => convocadosPreMap.set(c.funcionario_id, c));

      const itens: ListaPresencaItem[] = colaboradores.map(colab => {
        const func = funcsData?.find(f => f.id === colab.funcionario_id);
        
        if (func) {
          // Match por ID — caso ideal
          return {
            nome_completo: func.nome_completo || colab.nome_funcionario || '',
            matricula: func.matricula || null,
            cpf: func.cpf || '',
            hora_entrada: colab?.hora_entrada || '',
            hora_saida: colab?.hora_saida || '',
          };
        }

        // Fallback: match por nome normalizado via RPC
        const nomeNorm = normalizeName(colab.nome_funcionario || '');
        if (nomeNorm && rpcFuncionarios.length > 0) {
          const matches = rpcFuncionarios.filter(f => normalizeName(f.nome_completo || '') === nomeNorm);
          if (matches.length === 1) {
            return {
              nome_completo: matches[0].nome_completo || colab.nome_funcionario || '',
              matricula: matches[0].matricula || null,
              cpf: matches[0].cpf || '',
              hora_entrada: colab?.hora_entrada || '',
              hora_saida: colab?.hora_saida || '',
            };
          }
          if (matches.length > 1) {
            console.warn(`[PDF] Nome ambíguo para "${colab.nome_funcionario}" — ${matches.length} correspondências. Usando snapshot.`);
          }
        }

        // Fallback final: snapshot do convocados_pre
        const snapshot = convocadosPreMap.get(colab.funcionario_id);
        return {
          nome_completo: colab.nome_funcionario || '',
          matricula: snapshot?.matricula || null,
          cpf: snapshot?.cpf || '',
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
    if (!isOpen || !solicitacao?.id) {
      setHasValidatedDateStructure(false);
      return;
    }

    setHasValidatedDateStructure(false);
    const frame = window.requestAnimationFrame(() => {
      setHasValidatedDateStructure(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, solicitacao?.id, solicitacao?.data_inicio, solicitacao?.data_fim, possuiSnapshotEstruturado, datasSelecionaveis.length]);

  useEffect(() => {
    if (!isOpen || (!selectedDate && !legacyMode) || convocadosPre.length === 0) return;

    const initColaboradores = async () => {
      setIsLoadingExisting(true);

      try {
        const existentes = selectedDate
          ? await getPresencasPorSolicitacao(
              solicitacao?.id || "",
              selectedDate
            )
          : [];

        if (existentes.length > 0) {
          setHasExistingData(true);
            const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
            const existente = existentes.find(
              (e) => e.funcionario_id === conv.funcionario_id
            );
              const dateSel = parseBrazilianDate(selectedDate);
              const isDomingo = dateSel.getDay() === 0;
              const isSabado = dateSel.getDay() === 6;
              const isFeriado = feriados.some(f => f.data === selectedDate);
              const regraDia = aplicarOverrideSolicitacaoNaRegra(selectedDate);
              const usarExclusiva = conv.usar_diaria_exclusiva === true || regraDia.usaDiariaExclusiva || isDomingo || isSabado || isFeriado;

            // Cruzar com valores atuais de bd_funcoes
            const funcaoAtual = funcoesCompletas.find(f => f.id === conv.funcao_id);
            const vNormal = funcaoAtual?.valor_diaria ?? conv.valor_diaria;
            const vExclusiva = funcaoAtual?.valor_diaria_exclusiva ?? conv.valor_diaria_exclusiva ?? vNormal;
            // REGRA AUTORITATIVA POR DATA: sábado/domingo/feriado ou flag do convocado => exclusiva.
            // Não usar heurística de "valor mais próximo" do existente, para não perpetuar erros históricos.
            const existenteUsaExclusiva = usarExclusiva;
            const valorOriginal = existenteUsaExclusiva ? vExclusiva : vNormal;

              return {
              index,
              funcionario_id: conv.funcionario_id,
              nome_funcionario: conv.nome_funcionario || "",
              funcao_id: conv.funcao_id,
              nome_funcao: conv.nome_funcao,
              valor_diaria_original: valorOriginal,
              valor_diaria: funcaoAtual ? valorOriginal : (existente?.valor_diaria_aplicada || valorOriginal),
              presente: existente?.presente || false,
              hora_entrada: existente?.hora_entrada || "",
              hora_saida: existente?.hora_saida || "",
              tipo_diaria: (existente?.tipo_diaria as TipoDiaria) || 'completa',
              recebe_refeicao: existente?.recebe_refeicao ?? true,
              valor_refeicao_aplicado: existente?.valor_refeicao_aplicado ?? 0,
              presencaId: existente?.id,
              usarDiariaExclusiva: existenteUsaExclusiva,
              valor_diaria_normal: vNormal,
              valor_diaria_exclusiva_valor: vExclusiva,
                turno: (existente?.turno as TurnoDiaria) || 'diurno',
                remessaLiberada: regraDia.permiteRemessaMatriculados,
                diariaExclusivaOperacional: regraDia.usaDiariaExclusiva,
                tipoDiaOperacional: regraDia.tipoDiaOperacional,
                observacaoOperacional: regraDia.descricao,
            };
          });

          // Detectar funcionários avulsos: presenças existentes cujo funcionario_id NÃO está em convocadosPre
          const convocadoIds = new Set(convocadosPre.map(c => c.funcionario_id));
          const presencasAvulsas = existentes.filter(e => !convocadoIds.has(e.funcionario_id));

          if (presencasAvulsas.length > 0) {
            // Buscar dados dos funcionários avulsos
            const avulsoIds = presencasAvulsas.map(p => p.funcionario_id);
            const { data: avulsosFuncs } = await supabase
              .from('bd_funcionarios')
              .select('id, nome_completo, funcao_id, bd_funcoes(id, nome_funcao, valor_diaria, valor_diaria_exclusiva)')
              .in('id', avulsoIds);

            const newAvulsoSet = new Set(funcionariosAvulsos);
            const dateSel = parseBrazilianDate(selectedDate);
            const isDomingo = dateSel.getDay() === 0;
            const isSabado = dateSel.getDay() === 6;
            const isFeriadoFlag = feriados.some(f => f.data === selectedDate);

            presencasAvulsas.forEach((existente, i) => {
              const funcData = avulsosFuncs?.find(f => f.id === existente.funcionario_id);
              const funcaoData = funcData?.bd_funcoes as any;
              const vNormal = funcaoData?.valor_diaria || 0;
              const vExclusiva = funcaoData?.valor_diaria_exclusiva || vNormal;
              const usarExclusiva = isDomingo || isSabado || isFeriadoFlag;
              // REGRA AUTORITATIVA POR DATA: não reinterpretar valor histórico.
              const existenteUsaExclusiva = usarExclusiva;
              const valorOriginal = existenteUsaExclusiva ? vExclusiva : vNormal;

              mapped.push({
                index: mapped.length,
                funcionario_id: existente.funcionario_id,
                nome_funcionario: funcData?.nome_completo || '',
                funcao_id: funcaoData?.id || existente.funcao_id || null,
                nome_funcao: funcaoData?.nome_funcao || '',
                valor_diaria_original: valorOriginal,
                valor_diaria: funcaoData ? valorOriginal : (existente.valor_diaria_aplicada || valorOriginal),
                presente: existente.presente || false,
                hora_entrada: existente.hora_entrada || "",
                hora_saida: existente.hora_saida || "",
                tipo_diaria: (existente.tipo_diaria as TipoDiaria) || 'completa',
                recebe_refeicao: existente.recebe_refeicao ?? true,
                valor_refeicao_aplicado: existente.valor_refeicao_aplicado ?? 0,
                presencaId: existente.id,
                usarDiariaExclusiva: existenteUsaExclusiva,
                valor_diaria_normal: vNormal,
                valor_diaria_exclusiva_valor: vExclusiva,
                turno: (existente.turno as TurnoDiaria) || 'diurno'
              });
              newAvulsoSet.add(existente.funcionario_id);
            });
            setFuncionariosAvulsos(newAvulsoSet);
          }

          setColaboradores(mapped);
          setFase(determinarFase(mapped, true));
        } else {
          setHasExistingData(false);
          const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
            const dateSel2 = selectedDate ? parseBrazilianDate(selectedDate) : null;
            const isDomingo2 = dateSel2 ? dateSel2.getDay() === 0 : false;
            const isSabado2 = dateSel2 ? dateSel2.getDay() === 6 : false;
            const isFeriado2 = !!selectedDate && feriados.some(f => f.data === selectedDate);
            // Respeitar flag usar_diaria_exclusiva do convocado_pre
            const usarExclusiva2 = conv.usar_diaria_exclusiva === true || isDomingo2 || isSabado2 || isFeriado2;

            // Cruzar com valores atuais de bd_funcoes
            const funcaoAtual2 = funcoesCompletas.find(f => f.id === conv.funcao_id);
            const vNormal = funcaoAtual2?.valor_diaria ?? conv.valor_diaria;
            const vExclusiva = funcaoAtual2?.valor_diaria_exclusiva ?? conv.valor_diaria_exclusiva ?? vNormal;
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
              valor_diaria_exclusiva_valor: vExclusiva,
              turno: 'diurno' as TurnoDiaria
            };
          });
          setColaboradores(mapped);
          
          // Se a data é passada e não há registros, marcar como concluído (falta) e bloquear
            const hojeStr = getCurrentBrazilianDate();
            const isDataPassada = !!selectedDate && selectedDate < hojeStr;
            if (isDataPassada && !(edicaoLiberada && isSuperAdmin)) {
            setFase('concluido');
          } else {
            setFase('inicio');
          }
        }
      } catch (error) {
        console.error("Erro ao carregar presenças:", error);
      const mapped: ColaboradorPresenca[] = convocadosPre.map((conv, index) => {
          const funcaoAtualErr = funcoesCompletas.find(f => f.id === conv.funcao_id);
          const vNormal = funcaoAtualErr?.valor_diaria ?? conv.valor_diaria;
          const vExclusiva = funcaoAtualErr?.valor_diaria_exclusiva ?? conv.valor_diaria_exclusiva ?? vNormal;
          const usarExclusivaFallback = !!conv.usar_diaria_exclusiva;
          return {
            index,
            funcionario_id: conv.funcionario_id,
            nome_funcionario: conv.nome_funcionario || "",
            funcao_id: conv.funcao_id,
            nome_funcao: conv.nome_funcao,
            valor_diaria_original: usarExclusivaFallback ? vExclusiva : vNormal,
            valor_diaria: usarExclusivaFallback ? vExclusiva : vNormal,
            presente: false,
            hora_entrada: "",
            hora_saida: "",
            tipo_diaria: 'completa',
            recebe_refeicao: true,
            valor_refeicao_aplicado: 0,
            usarDiariaExclusiva: usarExclusivaFallback,
            valor_diaria_normal: vNormal,
            valor_diaria_exclusiva_valor: vExclusiva,
            turno: 'diurno' as TurnoDiaria
          };
        });
        setColaboradores(mapped);
        setFase('inicio');
      } finally {
        setIsLoadingExisting(false);
      }
    };

    initColaboradores();
  }, [isOpen, selectedDate, convocadosPre, solicitacao?.id, funcoesCompletas, feriados, legacyMode]);

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
    } else if (isOpen && legacyMode) {
      setSelectedDate("");
    } else if (!isOpen) {
      setSelectedDate("");
      setHasValidatedDateStructure(false);
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
  }, [isOpen, datasDisponiveis, initialDate, legacyMode]);

  // Recalcular jornada ao mudar horários
  const recalcularJornada = useCallback((col: ColaboradorPresenca): ColaboradorPresenca => {
    if (!col.presente) {
      return { ...col, tipo_diaria: 'nenhuma', valor_diaria: 0 };
    }
    const { tipo } = calcularJornada(col.hora_entrada, col.hora_saida);
    const novoValor = calcularValorDiaria(col.valor_diaria_original, tipo);
    return { ...col, tipo_diaria: tipo, valor_diaria: novoValor };
  }, []);

  const informarAcaoIndisponivelLegado = useCallback(() => {
    toast.info('No formato antigo, apenas a inclusão e remoção de convocados ficam disponíveis.');
  }, []);

  // Auto-finalização removida do frontend — agora roda via Edge Function no backend às 16:00 BRT

  // Handlers
  const handlePresencaChange = (index: number, presente: boolean) => {
    if (readOnly) return;
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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

  const persistirFuncionarioSelecionado = useCallback(async (
    funcionario: FuncionarioBuscaItem,
    classificacao: Extract<ClassificacaoOperacional, { status: 'elegivel' | 'pendente_aprovacao' }>
  ) => {
    if (!solicitacao?.id) return;

    const nomeFuncao = funcionario.funcao_nome || funcionario.bd_funcoes?.nome_funcao || 'Sem função';
    const valorDiaria = funcionario.valor_diaria || funcionario.bd_funcoes?.valor_diaria || 0;
    const funcao = funcoesCompletas.find(f => f.id === funcionario.funcao_id);
    const valorDiariaExclusiva = funcao?.valor_diaria_exclusiva || funcionario.bd_funcoes?.valor_diaria_exclusiva || valorDiaria;

    const novoConvocado = {
      funcionario_id: funcionario.id,
      funcao_id: funcionario.funcao_id || '',
      valor_diaria: valorDiaria,
      valor_diaria_exclusiva: valorDiariaExclusiva,
      valor_refeicao: funcao?.valor_refeicao || funcionario.valor_refeicao || 0,
      nome_funcionario: funcionario.nome_completo,
      nome_funcao: nomeFuncao,
      cpf: funcionario.cpf || '',
      matricula: funcionario.matricula || ''
    };

    await adicionarFuncionarioConvocado(solicitacao.id, novoConvocado);

    const novoColab = buildColaboradorFromFuncionario(funcionario, {
      index: colaboradores.length,
      remessaLiberada: classificacao.regra.permiteRemessaMatriculados,
      diariaExclusivaOperacional: classificacao.regra.usaDiariaExclusiva,
      tipoDiaOperacional: classificacao.regra.tipoDiaOperacional,
      observacaoOperacional: classificacao.regra.descricao,
      statusExcecao: classificacao.status === 'pendente_aprovacao' ? 'pendente_aprovacao' : null,
    });

    setColaboradores(prev => [...prev, novoColab]);
    setFuncionariosAvulsos(prev => new Set(prev).add(funcionario.id));
  }, [solicitacao?.id, funcoesCompletas, colaboradores.length, buildColaboradorFromFuncionario]);

  const classificarAdicaoOperacional = useCallback(async (funcionario: FuncionarioBuscaItem): Promise<ClassificacaoOperacional> => {
    if (legacyMode || !selectedDate) {
      return {
        status: 'elegivel',
        regra: regraOperacionalFallback,
        mensagem: 'Funcionário adicionado ao período geral da solicitação.',
      };
    }

    const regraBase = await resolverRegraOperacional({
      data: selectedDate,
      centroCustoId: centroCusto?.id,
      diretoriaId,
    });
    const regra = aplicarOverrideSolicitacaoNaRegra(selectedDate, regraBase);

    const temMatricula = !!funcionario.matricula;
    const tipoDia = regra.tipoDiaOperacional;
    const exigeAprovacao = !!regra.exigeAprovacaoAdicao;
    const remessaPermitida = !!regra.permiteRemessaMatriculados;
    const diaEstrategico = tipoDia === 'feriado_estrategico' || tipoDia === 'operacional' || tipoDia === 'compensado';

    if (temMatricula && !remessaPermitida) {
      if (exigeAprovacao || diaEstrategico) {
        return {
          status: 'pendente_aprovacao',
          regra,
          mensagem: 'Inclusão marcada como exceção operacional pendente de aprovação.',
        };
      }

      return {
        status: 'ignorado',
        regra,
        mensagem: 'Funcionário com matrícula não pode ser adicionado nesta data operacional.',
      };
    }

    return {
      status: 'elegivel',
      regra,
      mensagem: remessaPermitida && temMatricula ? 'Remessa permitida para esta data.' : undefined,
    };
  }, [selectedDate, centroCusto?.id, diretoriaId, legacyMode, regraOperacionalFallback, aplicarOverrideSolicitacaoNaRegra]);

  const handleAdicionarFuncionario = async (funcionario: FuncionarioBuscaItem) => {
    if (!solicitacao?.id) return;
    setIsAddingFuncionario(true);
    try {
      // Verificar se está em outra solicitação
      const { emOutra, numeroSolicitacao, solicitacaoId: outraId } = await verificarFuncionarioEmOutraSolicitacao(
        funcionario.id,
        solicitacao.data_inicio,
        solicitacao.data_fim,
        solicitacao.id
      );

      if (emOutra && outraId) {
        // Mostrar diálogo de transferência ao invés de bloquear
        setTransferConflict({
          funcionario,
          outraSolicitacaoId: outraId,
          numeroSolicitacao: numeroSolicitacao || ''
        });
        setIsAddingFuncionario(false);
        return;
      }

      const classificacao = await classificarAdicaoOperacional(funcionario);
      if (classificacao.status === 'ignorado') {
        toast.error(classificacao.mensagem);
        return;
      }

      await persistirFuncionarioSelecionado(funcionario, classificacao);
      // Invalidar queries para atualizar a solicitação
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });

      toast.success(classificacao.mensagem || `${funcionario.nome_completo} adicionado à lista de convocados.`);
      setSearchTerm("");
    } catch (error: any) {
      console.error('Erro ao adicionar funcionário:', error);
      toast.error(error.message || 'Erro ao adicionar funcionário.');
    } finally {
      setIsAddingFuncionario(false);
    }
  };

  // Handler para remover/liberar funcionário da lista
  const handleRemoverFuncionario = async (funcionarioId: string, nomeFuncionario: string, forcarRemocao?: boolean) => {
    if (!solicitacao?.id) return;
    try {
      await removerFuncionarioConvocado(solicitacao.id, funcionarioId, forcarRemocao);
      setColaboradores(prev => prev.filter(c => c.funcionario_id !== funcionarioId));
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      toast.success(`${nomeFuncionario} liberado da lista.`);
    } catch (error: any) {
      console.error('Erro ao liberar funcionário:', error);
      toast.error(error.message || 'Erro ao liberar funcionário.');
    }
  };

  // Handler para confirmar transferência de funcionário entre solicitações
  const handleConfirmTransfer = async () => {
    if (!transferConflict || !solicitacao?.id) return;
    setIsTransferring(true);
    try {
      const { funcionario, outraSolicitacaoId } = transferConflict;
      
      // 1. Remover da solicitação de origem
      await removerFuncionarioConvocado(outraSolicitacaoId, funcionario.id);
      
      const classificacao = await classificarAdicaoOperacional(funcionario);
      if (classificacao.status === 'ignorado') {
        toast.error(classificacao.mensagem);
        return;
      }

      await persistirFuncionarioSelecionado(funcionario, classificacao);
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });

      toast.success(`${funcionario.nome_completo} transferido com sucesso para esta solicitação.`);
      setSearchTerm("");
    } catch (error: any) {
      console.error('Erro ao transferir funcionário:', error);
      toast.error(error.message || 'Erro ao transferir funcionário.');
    } finally {
      setIsTransferring(false);
      setTransferConflict(null);
    }
  };

  const handleAdicionarTodosResultados = async () => {
    if (!solicitacao?.id || resultadosBusca.length === 0) return;
    setIsAddingAllCentroCusto(true);
    try {
      let adicionados = 0;
      let pendentes = 0;
      let ignorados = 0;

      for (const funcionario of resultadosBusca) {
        const { emOutra } = await verificarFuncionarioEmOutraSolicitacao(
          funcionario.id,
          solicitacao.data_inicio,
          solicitacao.data_fim,
          solicitacao.id
        );

        if (emOutra) {
          ignorados += 1;
          continue;
        }

        const classificacao = await classificarAdicaoOperacional(funcionario);
        if (classificacao.status === 'ignorado') {
          ignorados += 1;
          continue;
        }

        await persistirFuncionarioSelecionado(funcionario, classificacao);
        if (classificacao.status === 'pendente_aprovacao') pendentes += 1;
        else adicionados += 1;
      }

      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });
      toast.success(`Adicionados: ${adicionados}. Pendentes: ${pendentes}. Ignorados: ${ignorados}.`);
      setSearchTerm('');
      setSelectedFuncionariosIds(new Set());
    } catch (error: any) {
      console.error('Erro ao adicionar todos os funcionários:', error);
      toast.error(error.message || 'Erro ao adicionar todos os funcionários.');
    } finally {
      setIsAddingAllCentroCusto(false);
    }
  };

  const handleEnviarPendentesParaAprovacao = async () => {
    if (!solicitacao?.id || pendentesLocais.length === 0) return;
    setIsSendingApproval(true);
    try {
      let enviados = 0;
      let falhas = 0;
      const atualizacoes = new Map<string, string>();

      for (const colaborador of pendentesLocais) {
        try {
          const pendencia = await solicitarInclusaoFuncionario({
            solicitacaoId: solicitacao.id,
            funcionarioId: colaborador.funcionario_id,
            justificativa: colaborador.observacaoOperacional || addJustificativa || 'Exceção operacional pendente de aprovação.',
          });
          atualizacoes.set(colaborador.funcionario_id, pendencia.id);
          enviados += 1;
        } catch (error) {
          falhas += 1;
        }
      }

      if (atualizacoes.size > 0) {
        setColaboradores((prev) => prev.map((col) => atualizacoes.has(col.funcionario_id)
          ? { ...col, pendenciaInclusaoId: atualizacoes.get(col.funcionario_id) }
          : col
        ));
        queryClient.invalidateQueries({ queryKey: ['inclusoes-pendentes-apontamento', solicitacao.id] });
      }

      toast.success(falhas > 0
        ? `Solicitação enviada para aprovação (${enviados} enviados, ${falhas} falhas).`
        : 'Solicitação enviada para aprovação');
    } finally {
      setIsSendingApproval(false);
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
    setColaboradores((prev) =>
      prev.map((col) =>
        col.index === index ? { ...col, recebe_refeicao: recebe } : col
      )
    );
  };

  // Toggle tipo de diária (Normal vs FDS/Feriado) por funcionário
  const handleTipoDiariaChange = (index: number, usarExclusiva: boolean) => {
    if (readOnly) return;
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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

  // Toggle turno (Diurno/Noturno) por funcionário
  const handleTurnoChange = (index: number, turno: TurnoDiaria) => {
    if (readOnly) return;
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
    if (fase === 'concluido' && !edicaoLiberada) return;
    setColaboradores((prev) =>
      prev.map((col) =>
        col.index === index ? { ...col, turno } : col
      )
    );
  };

  // Salvar Início
  const handleSalvarInicio = async () => {
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
    if (!solicitacao?.id || !selectedDate) return;

    setIsSaving(true);
    try {
      const registros: InicioFormData[] = colaboradores.map(col => ({
        funcionario_id: col.funcionario_id,
        funcao_id: col.funcao_id,
        presente: col.presente,
        hora_entrada: col.presente ? col.hora_entrada : undefined,
        valor_diaria_original: col.valor_diaria_original,
        usar_diaria_exclusiva: col.usarDiariaExclusiva,
        turno: col.turno,
        recebe_refeicao: col.recebe_refeicao ?? true,
        valor_refeicao_aplicado: (col.recebe_refeicao ?? true) ? (funcoesMap[col.funcao_id] || 0) : 0,
      }));

      const resultado = await salvarInicio(solicitacao.id, selectedDate, registros);
      
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
      const mensagem = montarMensagemInsercao(resultado);
      if (resultado.inseridos > 0) {
        toast.success(mensagem);
      } else {
        toast.info(mensagem || 'Nenhum novo funcionário foi adicionado.');
      }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
    if (!solicitacao?.id || !selectedDate) return;

    // Atrasados sem presencaId (avulsos novos)
    const atrasadosSemId = colaboradores.filter(c => c.presente && !c.presencaId);
    // Atrasados com presencaId (eram falta, agora presente)
    const atrasadosConvertidos = colaboradores.filter(c => c.presente && c.presencaId && faltaConvertida.has(c.funcionario_id));
    
    if (atrasadosSemId.length === 0 && atrasadosConvertidos.length === 0) return;

    setIsSaving(true);
    try {
      let resultadoInsercao: ResultadoInsercaoIdempotente = {
        totalSolicitado: 0,
        inseridos: 0,
        ignorados: 0,
      };

      // INSERT para avulsos sem registro
      if (atrasadosSemId.length > 0) {
        const registros: InicioFormData[] = atrasadosSemId.map(col => ({
          funcionario_id: col.funcionario_id,
          funcao_id: col.funcao_id,
          presente: col.presente,
          hora_entrada: col.hora_entrada || undefined,
          valor_diaria_original: col.valor_diaria_original,
          usar_diaria_exclusiva: col.usarDiariaExclusiva,
          turno: col.turno
        }));
        resultadoInsercao = await salvarInicioParcial(solicitacao.id, selectedDate, registros);
      }

      // UPDATE para quem era falta e agora é presente
      if (atrasadosConvertidos.length > 0) {
        const registrosUpdate = atrasadosConvertidos.map(col => ({
          id: col.presencaId!,
          hora_entrada: col.hora_entrada || format(new Date(), 'HH:mm'),
          valor_diaria_original: col.valor_diaria_original,
          usar_diaria_exclusiva: col.usarDiariaExclusiva,
          turno: col.turno
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

      const linhasMensagem: string[] = [];
      const mensagemInsercao = montarMensagemInsercao(resultadoInsercao, {
        singularInserido: 'atrasado adicionado com sucesso',
        pluralInserido: 'atrasados adicionados com sucesso',
        nenhumInserido: 'Nenhum novo atrasado foi adicionado',
        singularIgnorado: 'já estava apontado e foi ignorado',
        pluralIgnorado: 'já estavam apontados e foram ignorados',
      });

      if (mensagemInsercao) linhasMensagem.push(mensagemInsercao);

      if (atrasadosConvertidos.length > 0) {
        linhasMensagem.push(
          `${atrasadosConvertidos.length} ${atrasadosConvertidos.length === 1 ? 'registro foi atualizado com entrada' : 'registros foram atualizados com entrada'}`
        );
      }

      if (resultadoInsercao.inseridos > 0 || atrasadosConvertidos.length > 0) {
        toast.success(linhasMensagem.join('\n'));
      } else {
        toast.info(linhasMensagem.join('\n') || 'Nenhum novo atrasado foi adicionado.');
      }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
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
    if (legacyPresenceActionsDisabled) {
      informarAcaoIndisponivelLegado();
      return;
    }
    if (!solicitacao?.id || !selectedDate || !observacaoCorrecao.trim()) return;

    setIsSaving(true);
    try {
      let resultadoInsercao: ResultadoInsercaoIdempotente = {
        totalSolicitado: 0,
        inseridos: 0,
        ignorados: 0,
      };

      // Separar: com presencaId → UPDATE, sem presencaId → INSERT
      const comPresenca = colaboradores.filter(c => c.presencaId);
      const semPresenca = colaboradores.filter(c => c.presente && !c.presencaId);

      // UPDATE existentes via salvarCorrecao
      if (comPresenca.length > 0) {
        const registrosUpdate: CorrecaoFormData[] = comPresenca.map(col => {
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
            valor_refeicao_aplicado: col.recebe_refeicao ? (funcoesMap[col.funcao_id] || 0) : 0,
            turno: col.turno,
            funcao_id: col.funcao_id || undefined
          };
        });
        await salvarCorrecao(solicitacao.id, selectedDate, registrosUpdate, observacaoCorrecao);
      }

      // INSERT novos (sem presencaId) via inserirPresencasCompletas (com hora_saida para aparecer no relatório)
      if (semPresenca.length > 0) {
        const registrosInsert: CorrecaoFormData[] = semPresenca.map(col => {
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
            valor_refeicao_aplicado: col.recebe_refeicao ? (funcoesMap[col.funcao_id] || 0) : 0,
            turno: col.turno,
            funcao_id: col.funcao_id || undefined
          };
        });
        resultadoInsercao = await inserirPresencasCompletas(solicitacao.id, selectedDate, registrosInsert, observacaoCorrecao);
      }

      const linhasMensagem: string[] = [];
      const mensagemInsercao = montarMensagemInsercao(resultadoInsercao);
      if (comPresenca.length > 0) {
        linhasMensagem.push(
          `${comPresenca.length} ${comPresenca.length === 1 ? 'registro foi atualizado' : 'registros foram atualizados'}`
        );
      }
      if (mensagemInsercao) linhasMensagem.push(mensagemInsercao);

      if (resultadoInsercao.inseridos > 0 || comPresenca.length > 0) {
        toast.success(linhasMensagem.join('\n') || 'Correção salva com sucesso!');
      } else {
        toast.info(linhasMensagem.join('\n') || 'Nenhum novo funcionário foi adicionado.');
      }
      setObservacaoCorrecao("");
      onSaveSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar correção:", error);
      toast.error('Erro ao salvar correção.');
    } finally {
      setIsSaving(false);
    }
  };

  const faseLabel = {
    inicio: { text: 'Registrar Entrada', color: 'text-blue-600' },
    finalizacao: { text: 'Registrar Saída', color: 'text-orange-600' },
    concluido: { text: 'Concluído', color: 'text-green-600 dark:text-green-400' }
  };

  const totalPresentes = colaboradores.filter((c) => c.presente).length;

  // Filtro local da lista (nome, cpf, função) — não altera dados, apenas a renderização
  const filtroColaboradoresNorm = filtroColaboradores.trim().toLowerCase();
  const colaboradoresFiltrados = filtroColaboradoresNorm
    ? colaboradores.filter((c) => {
        const nome = (c.nome_funcionario || '').toLowerCase();
        const funcao = (c.nome_funcao || '').toLowerCase();
        const cpf = (cpfMap[c.funcionario_id] || '').toLowerCase();
        const cpfDigits = cpf.replace(/\D/g, '');
        const termoDigits = filtroColaboradoresNorm.replace(/\D/g, '');
        return (
          nome.includes(filtroColaboradoresNorm) ||
          funcao.includes(filtroColaboradoresNorm) ||
          cpf.includes(filtroColaboradoresNorm) ||
          (termoDigits.length > 0 && cpfDigits.includes(termoDigits))
        );
      })
    : colaboradores;

  // Tipo do dia ativo (snapshot ou calendário) e valor de diária correspondente
  const tipoDiaAtivoLabel = (() => {
    if (!selectedDate) return null;
    const tipoManual = resolveTipoDiaManual(selectedDate);
    if (tipoManual === 'feriado') return 'Feriado';
    if (tipoManual === 'ponte') return 'Ponte';
    const isFeriadoCalendario = feriados.some((f) => f.data === selectedDate);
    if (isFeriadoCalendario) return 'Feriado';
    const dateSel = parseBrazilianDate(selectedDate);
    const dow = dateSel.getDay();
    if (dow === 0) return 'Domingo';
    if (dow === 6) return 'Sábado';
    return 'Normal';
  })();
  const tipoDiaUsaExclusiva = tipoDiaAtivoLabel === 'Feriado' || tipoDiaAtivoLabel === 'Ponte' || tipoDiaAtivoLabel === 'Domingo' || tipoDiaAtivoLabel === 'Sábado';

  if (!apontamento || !solicitacao) return null;


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] max-h-[95vh] overflow-y-auto p-3 sm:max-w-[980px] sm:p-6">
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
                  <span>{centroCusto?.codigo_centro_custo || 'N/A'}</span>
                  <span className="hidden sm:inline"> - {centroCusto?.nome_centro_custo || 'N/A'}</span>
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Data do Apontamento - Seletor de datas do período */}
          <div className="shrink-0 space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Data do Apontamento
            </Label>

            {datasSelecionaveis.length > 0 ? (
              <>
                {/* Seletor de datas como badges clicáveis */}
                <div className="grid grid-cols-1 gap-2 rounded-md border bg-muted p-2 sm:grid-cols-2 xl:grid-cols-3 sm:p-3">
                  {datasDisponiveis.map(d => {
                    const isSelected = d.value === selectedDate;
                    const regraData = regrasOperacionaisPorData[d.value];
                    const badgeTipoDia = getTipoDiaBadge(d.value, {
                      isFeriado: d.isFeriado,
                      isWeekend: d.isWeekend,
                      nomeFeriado: d.nomeFeriado,
                    });
                    const possuiOverrideOperacional = badgeTipoDia.manual;
                    const salvandoTipoDia = !!tiposDiaSaving[d.value];
                    return (
                      <div
                        key={d.value}
                        className={cn(
                          "flex items-center gap-2 rounded-md border bg-background p-1.5 transition-colors",
                          isSelected && "border-primary",
                          possuiOverrideOperacional && "ring-1 ring-primary"
                        )}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (!d.disabled) {
                                  setSelectedDate(d.value);
                                  setHasSaved(false);
                                  setSaidasSalvas(new Set());
                                }
                              }}
                              disabled={d.disabled}
                              className={cn(
                                "flex min-w-0 flex-1 flex-col items-start rounded-sm px-2 py-1 text-left text-xs font-medium transition-colors",
                                d.disabled
                                  ? "cursor-not-allowed text-muted-foreground opacity-50"
                                  : isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent text-foreground",
                                d.isHoje && !isSelected && !d.disabled && "ring-1 ring-primary"
                              )}
                            >
                              <span className="truncate capitalize">{d.label}</span>
                              <span className="mt-1 flex items-center gap-1 text-[10px] opacity-80">
                                {d.isWeekend && <span>FDS</span>}
                                {d.isFeriado && <span>Feriado</span>}
                                {possuiOverrideOperacional && <span>R</span>}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p className="font-medium capitalize">{d.labelFull}</p>
                              <p>Tipo: {badgeTipoDia.label}</p>
                              {regraData?.descricao && <p>Obs.: {regraData.descricao}</p>}
                              {regraData?.encontrada && (
                                <p>
                                  Flags: {regraData.permiteRemessaMatriculados ? 'remessa' : 'sem remessa'} · {regraData.usaDiariaExclusiva ? 'diária exclusiva' : 'padrão'}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={d.disabled || salvandoTipoDia}
                              className="min-h-10 min-w-[7rem] px-2 text-[10px] font-semibold"
                            >
                              {salvandoTipoDia ? (
                                <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Salvando...</span>
                              ) : (
                                badgeTipoDia.label
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-1" align="end">
                            <div className="flex flex-col gap-1">
                              {(['normal', 'feriado', 'ponte'] as TipoDiaManual[]).map((tipoDia) => (
                                <Button
                                  key={tipoDia}
                                  type="button"
                                  variant={resolveTipoDiaManual(d.value) === tipoDia ? 'default' : 'ghost'}
                                  size="sm"
                                  disabled={salvandoTipoDia}
                                  className="justify-start"
                                  onClick={() => void persistirTipoDiaSolicitacao(d.value, tipoDia)}
                                >
                                  {TIPO_DIA_LABEL[tipoDia]}
                                </Button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  })}
                </div>

                {/* Info da data selecionada */}
                {dataSelecionadaInfo && (
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:text-sm">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
                      {getTipoDiaBadge(dataSelecionadaInfo.value, dataSelecionadaInfo).manual && (
                        <Badge variant="info" className="text-[10px] sm:text-xs">Tipo manual ativo</Badge>
                      )}
                    </div>
                    <Badge
                      variant={fase === 'concluido' ? 'success' : fase === 'finalizacao' ? 'warning' : 'secondary'}
                      className="w-fit text-[10px] sm:justify-self-end sm:text-xs"
                    >
                      {faseLabel[fase].text}
                    </Badge>
                  </div>
                )}

                {dataSelecionadaInfo && (dataSelecionadaInfo.isWeekend || dataSelecionadaInfo.isFeriado || getTipoDiaBadge(dataSelecionadaInfo.value, dataSelecionadaInfo).manual) && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {getTipoDiaBadge(dataSelecionadaInfo.value, dataSelecionadaInfo).manual
                        ? `${getTipoDiaBadge(dataSelecionadaInfo.value, dataSelecionadaInfo).label} manual aplicado à solicitação.`
                        : dataSelecionadaInfo.isFeriado
                          ? `Feriado: ${dataSelecionadaInfo.nomeFeriado}`
                          : "Final de semana"}
                    </AlertDescription>
                  </Alert>
                )}

                {legacyMode && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Solicitação em formato antigo — adição sem controle por data
                    </AlertDescription>
                  </Alert>
                )}

                {legacyPresenceActionsDisabled && (
                  <Alert className="mt-2">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Ações de presença, início, saída e finalização exigem controle por data e permanecem indisponíveis neste formato.
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
                        disabled={legacyPresenceActionsDisabled}
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
              ) : legacyMode ? (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  Aguarde a validação das datas da solicitação.
                </div>
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
                  Edição liberada pelo administrador — os campos estão desbloqueados para correção, mas isso não amplia a busca de funcionários.
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

                {((fase === 'inicio' || fase === 'finalizacao') && !readOnly || (fase === 'concluido' && isSuperAdmin)) && (
                  <Popover open={showAddFuncionario} onOpenChange={(open) => { setShowAddFuncionario(open); if (!open) { setAddSelectedFunc(null); setAddJustificativa(""); setAddFerias(false); } }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="xs" className="text-[10px] sm:text-xs gap-1 h-6 sm:h-7 px-2">
                        <Plus className="h-3 w-3" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] sm:w-[380px] p-3" align="start">
                      <div className="space-y-3">
                        {/* Se tem funcionário selecionado, mostrar painel de confirmação */}
                        {addSelectedFunc ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">Adicionar Funcionário</h4>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAddSelectedFunc(null); setAddJustificativa(""); setAddFerias(false); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="p-2 bg-muted rounded-md">
                              <p className="text-sm font-medium">{addSelectedFunc.nome_completo}</p>
                              <p className="text-xs text-muted-foreground">{addSelectedFunc.funcao_nome || 'Sem função'}</p>
                              {addSelectedFunc.matricula && (
                                <Badge variant="outline" className="mt-1 text-[10px] px-1 py-0 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300">Remessa</Badge>
                              )}
                            </div>

                            {/* Toggle Férias para funcionários com matrícula em dia útil */}
                            {selectedDate && (() => {
                              const dateSel = parseBrazilianDate(selectedDate);
                              const dayOfWeek = dateSel.getDay();
                              const isDiaUtil = dayOfWeek >= 1 && dayOfWeek <= 5;
                              const isFeriadoHoje = feriados.some(f => f.data === selectedDate);
                              const tipoManual = resolveTipoDiaManual(selectedDate);
                              // Em feriado/ponte (manual ou calendário) o matriculado pode trabalhar
                              // sem precisar marcar "Férias"
                              const ehFeriadoOuPonte = isFeriadoHoje || tipoManual === 'feriado' || tipoManual === 'ponte';
                              const temMatricula = !!addSelectedFunc.matricula;
                              const mostrarToggle = temMatricula && isDiaUtil && !ehFeriadoOuPonte;
                              
                              return mostrarToggle ? (
                                <div className="flex items-center justify-between p-2 border rounded-md">
                                  <Label htmlFor="add-ferias" className="text-sm">Funcionário em Férias</Label>
                                  <Switch
                                    id="add-ferias"
                                    checked={addFerias}
                                    onCheckedChange={setAddFerias}
                                  />
                                </div>
                              ) : null;
                            })()}

                            {/* Alocação em outra solicitação */}
                            {addSelectedFunc._alocacao && (
                              <Alert variant="destructive" className="py-2">
                                <AlertTriangle className="h-3 w-3" />
                                <AlertDescription className="text-xs">
                                  Convocado no CC: {addSelectedFunc._alocacao.codigo_centro_custo} — Solicitação: {addSelectedFunc._alocacao.numero_solicitacao}
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Justificativa obrigatória */}
                            <div>
                              <Label className="text-sm">Justificativa *</Label>
                              <Textarea
                                value={addJustificativa}
                                onChange={(e) => setAddJustificativa(e.target.value)}
                                placeholder="Informe o motivo da inclusão deste funcionário..."
                                rows={2}
                                className="mt-1 text-sm"
                              />
                            </div>

                            <Button
                              className="w-full"
                              size="sm"
                              disabled={isAddingFuncionario || addJustificativa.trim().length < 5}
                              onClick={() => {
                                handleAdicionarFuncionario(addSelectedFunc);
                                setAddSelectedFunc(null);
                                setAddJustificativa("");
                                setAddFerias(false);
                              }}
                            >
                              {isAddingFuncionario && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              Confirmar Adição
                            </Button>

                            {getPreviewOperacional(addSelectedFunc).requerAprovacao && (
                              <p className="text-xs text-muted-foreground">
                                Esta inclusão será marcada como exceção operacional e ficará pendente de aprovação.
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Buscar por nome, CPF, matrícula ou centro de custo"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                              </div>
                              {searchTerm.trim() && totalResultadosBusca > 0 && (
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] text-muted-foreground">
                                    {totalResultadosBusca} resultado(s)
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    onClick={handleAdicionarTodosResultados}
                                    disabled={isAddingAllCentroCusto}
                                    className="h-7 gap-1"
                                  >
                                    {isAddingAllCentroCusto && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Adicionar todos
                                  </Button>
                                </div>
                              )}
                              {searchTerm.trim() && totalResultadosBusca > searchPageSize && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    onClick={() => setSearchPage((prev) => Math.max(prev - 1, 0))}
                                    disabled={searchPage === 0 || isSearchingFuncionarios}
                                    className="h-7 px-2"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </Button>
                                  <span className="text-[10px] text-muted-foreground">
                                    Página {searchPage + 1} de {Math.max(1, Math.ceil(totalResultadosBusca / searchPageSize))}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    onClick={() => setSearchPage((prev) => prev + 1)}
                                    disabled={(searchPage + 1) * searchPageSize >= totalResultadosBusca || isSearchingFuncionarios}
                                    className="h-7 px-2"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {searchTerm.trim() && modalReady && (
                              <ScrollArea className="max-h-[200px]">
                                {isSearchingFuncionarios ? (
                                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Buscando funcionários...
                                  </div>
                                ) : resultadosBusca.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    Nenhum funcionário encontrado
                                  </p>
                                ) : (
                                  <div className="space-y-1">
                                    {resultadosBuscaPaginados.map((func: FuncionarioBuscaItem) => {
                                      const preview = getPreviewOperacional(func);
                                      return (
                                      <button
                                        key={func.id}
                                        onClick={() => {
                                          setAddSelectedFunc(func);
                                          setAddFerias(false);
                                          setAddJustificativa("");
                                        }}
                                        disabled={isAddingFuncionario}
                                        className="w-full text-left p-2 rounded hover:bg-muted text-sm flex items-center justify-between"
                                      >
                                        <div>
                                          <div className="flex items-center gap-1">
                                            <p className="font-medium text-xs sm:text-sm">{func.nome_completo}</p>
                                            {func.matricula && (
                                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300">Remessa</Badge>
                                            )}
                                          </div>
                                          <p className="text-[10px] sm:text-xs text-muted-foreground">{func.funcao_nome || 'Sem função'}</p>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {preview.remessaPermitida && <Badge variant="info" className="text-[10px]">Remessa permitida</Badge>}
                                            {preview.excecaoOperacional && <Badge variant="warning" className="text-[10px]">Exceção operacional</Badge>}
                                            {preview.requerAprovacao && <Badge variant="secondary" className="text-[10px]">Requer aprovação</Badge>}
                                          </div>
                                        </div>
                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                      </button>
                                    )})}
                                  </div>
                                )}
                              </ScrollArea>
                            )}
                            {searchTerm.trim() && !modalReady && !legacyMode && (
                              <p className="py-2 text-center text-xs text-muted-foreground">
                                Aguarde o carregamento da data para habilitar a busca.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Filtro local da lista (nome, CPF, função) */}
                {colaboradores.length > 0 && (
                  <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="search"
                      value={filtroColaboradores}
                      onChange={(e) => setFiltroColaboradores(e.target.value)}
                      placeholder="Buscar funcionário..."
                      className="h-9 pl-7 text-xs sm:text-sm"
                      aria-label="Filtrar funcionários por nome, CPF ou função"
                    />
                  </div>
                )}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground flex items-center gap-2 sm:gap-3 flex-wrap">
                {tipoDiaAtivoLabel && (
                  <Badge
                    variant={tipoDiaUsaExclusiva ? 'warning' : 'secondary'}
                    className="text-[10px] sm:text-xs"
                  >
                    Dia: {tipoDiaAtivoLabel}
                  </Badge>
                )}
                <span>Presentes: <span className="font-medium text-primary">{totalPresentes}</span></span>
                <span>Faltas: <span className="font-medium text-destructive">{colaboradores.length - totalPresentes}</span></span>
                {filtroColaboradoresNorm && (
                  <span className="text-[10px]">
                    Exibindo {colaboradoresFiltrados.length} de {colaboradores.length}
                  </span>
                )}
              </div>
            </div>

            {isLoadingExisting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : colaboradores.length > 0 ? (
              <div className="border rounded-md p-2 sm:p-4">
                <div className="space-y-3 sm:space-y-4">
                  {colaboradoresFiltrados.length === 0 && filtroColaboradoresNorm && (
                    <div className="text-center text-xs text-muted-foreground py-4">
                      Nenhum funcionário encontrado para "{filtroColaboradores}".
                    </div>
                  )}
                  {colaboradoresFiltrados.map((colaborador) => {
                    const { horas, tipo } = calcularJornada(colaborador.hora_entrada, colaborador.hora_saida);
                    const valorRefeicao = funcoesMap[colaborador.funcao_id] || 0;

                    const presencaDisabled = legacyPresenceActionsDisabled || readOnly || (fase === 'concluido' && !edicaoLiberada) || (fase === 'finalizacao' && !!colaborador.presencaId && colaborador.presente && !faltaConvertida.has(colaborador.funcionario_id)) || (fase !== 'inicio' && fase !== 'finalizacao' && !(fase === 'concluido' && edicaoLiberada));
                    const isAtrasado = fase === 'finalizacao' && colaborador.presente && (!colaborador.presencaId || faltaConvertida.has(colaborador.funcionario_id));
                    const entradaDisabled = legacyPresenceActionsDisabled || (fase !== 'inicio' && fase !== 'finalizacao' && !(fase === 'concluido' && edicaoLiberada)) || !colaborador.presente || readOnly || (isAtrasado && !isSuperAdmin);
                    const jaSalvouSaida = saidasSalvas.has(colaborador.funcionario_id);
                    const saidaDisabled = legacyPresenceActionsDisabled || (fase !== 'finalizacao' && !(fase === 'concluido' && edicaoLiberada)) || !colaborador.presente || readOnly || jaSalvouSaida;
                    const refeicaoDisabled = legacyPresenceActionsDisabled || (fase === 'concluido' && !edicaoLiberada) || !colaborador.presente || readOnly || jaSalvouSaida;
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
                              {colaborador.turno === 'noturno' && (
                                <Badge variant="warning" className="text-[10px] shrink-0"><Moon className="h-2.5 w-2.5 mr-0.5" />Not.</Badge>
                              )}
                              <div className="flex items-center gap-1 shrink-0">
                                {fase === 'concluido' && colaborador.presente ? (
                                  <>
                                    {getBadgeJornada(tipo, horas)}
                                    <Badge variant="success" className="text-[10px] sm:text-xs hidden sm:flex items-center gap-1">
                                      <Lock className="h-2.5 w-2.5" /> Finalizado
                                    </Badge>
                                    <Lock className="h-3 w-3 text-green-600 dark:text-green-400 sm:hidden" />
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
                                    {!readOnly && (!colaborador.presencaId || isSuperAdmin) && (
                                      <Button variant="ghost" size="xs" onClick={() => setReleaseConfirm({ funcionarioId: colaborador.funcionario_id, nomeFuncionario: colaborador.nome_funcionario, hasPresenca: !!colaborador.presencaId && colaborador.presente === true && !!colaborador.hora_entrada })} className="h-5 w-5 p-0 text-destructive hover:text-destructive" title="Liberar funcionário">
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{colaborador.nome_funcao}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {colaborador.remessaLiberada && <Badge variant="info" className="text-[10px]">Remessa permitida</Badge>}
                              {colaborador.statusExcecao === 'pendente_aprovacao' && <Badge variant="warning" className="text-[10px]">Pendente aprovação</Badge>}
                              {colaborador.diariaExclusivaOperacional && <Badge variant="purple" className="text-[10px]">Exceção operacional</Badge>}
                            </div>
                            {colaborador.observacaoOperacional && (
                              <p className="mt-1 text-[10px] text-muted-foreground">{colaborador.observacaoOperacional}</p>
                            )}
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
                              <span title="Saída já salva"><Lock className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" /></span>
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
                              disabled={legacyPresenceActionsDisabled || isSavingIndividual === colaborador.funcionario_id}
                              className="text-[10px] sm:text-xs gap-1 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 h-6 w-full sm:w-auto"
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

                        {/* Toggle Turno: Diurno/Noturno */}
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed">
                          <div className="flex items-center gap-1.5">
                            <Moon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            <Label htmlFor={`turno-${colaborador.funcionario_id}`} className="text-xs sm:text-sm cursor-pointer">
                              Noturno
                            </Label>
                            {colaborador.turno === 'noturno' && (
                              <Badge variant="warning" className="text-[10px]">19h-07h</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                              <Switch
                              id={`turno-${colaborador.funcionario_id}`}
                              checked={colaborador.turno === 'noturno'}
                              onCheckedChange={(checked) => handleTurnoChange(colaborador.index, checked ? 'noturno' : 'diurno')}
                                disabled={legacyPresenceActionsDisabled || (fase === 'concluido' && !edicaoLiberada) || !colaborador.presente || readOnly || jaSalvouSaida}
                            />
                            {fase === 'concluido' && !edicaoLiberada && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Diária aplicada (derivada do tipo do dia) — somente leitura */}
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              Diária aplicada:
                            </span>
                            <Badge
                              variant={colaborador.usarDiariaExclusiva ? 'warning' : 'secondary'}
                              className="text-[10px]"
                            >
                              R$ {(colaborador.usarDiariaExclusiva
                                ? colaborador.valor_diaria_exclusiva_valor
                                : colaborador.valor_diaria_normal
                              ).toFixed(2)}
                              {tipoDiaAtivoLabel ? ` (${tipoDiaAtivoLabel})` : ''}
                            </Badge>
                          </div>
                        </div>

                        {isEditingThis && (
                          <div className="mt-3 pt-3 border-t border-dashed space-y-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                            <p className="text-xs font-medium flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
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
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {selectedDate || legacyMode
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
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {pendentesLocais.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEnviarPendentesParaAprovacao}
                  disabled={isSendingApproval}
                  className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
                >
                  {isSendingApproval ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Enviar para aprovação
                </Button>
              )}
              <Button
                onClick={handleSalvarInicio}
                disabled={legacyPresenceActionsDisabled || isSaving || hasSaved || !selectedDate || colaboradores.length === 0 || (edicaoLiberada && isSuperAdmin && !observacaoCorrecao.trim())}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
              >
                {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Clock className="h-3.5 w-3.5 mr-1.5" />Salvar Início</>}
              </Button>
            </div>
          )}

          {fase === 'finalizacao' && !readOnly && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Botão para salvar início de atrasados */}
              {(colaboradores.some(c => c.presente && !c.presencaId) || faltaConvertida.size > 0) && (
                <Button
                  onClick={handleSalvarInicioAtrasados}
                  disabled={legacyPresenceActionsDisabled || isSaving || !selectedDate || (edicaoLiberada && isSuperAdmin && !observacaoCorrecao.trim())}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
                >
                  {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Clock className="h-3.5 w-3.5 mr-1.5" />Salvar Início (Atrasados)</>}
                </Button>
              )}
              {/* Botão de finalização normal */}
              {!colaboradores.some(c => c.presente && !c.presencaId) && faltaConvertida.size === 0 && (
                <Button
                  onClick={handleSalvarFinalizacao}
                  disabled={legacyPresenceActionsDisabled || isSaving || !selectedDate || colaboradores.length === 0 || !colaboradores.filter(c => c.presente && !!c.presencaId).every(c => c.hora_saida) || (edicaoLiberada && isSuperAdmin && !observacaoCorrecao.trim())}
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
              disabled={legacyPresenceActionsDisabled || isSaving || !selectedDate || colaboradores.length === 0 || !observacaoCorrecao.trim()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
            >
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5 mr-1.5" />Salvar Correção</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <ConfirmDialog
        isOpen={!!transferConflict}
        onClose={() => setTransferConflict(null)}
        onConfirm={handleConfirmTransfer}
        title="Transferir funcionário"
        description={transferConflict 
          ? `${transferConflict.funcionario.nome_completo} está na solicitação Nº ${transferConflict.numeroSolicitacao}. Deseja liberá-lo automaticamente da outra solicitação e adicioná-lo aqui?`
          : ''
        }
        confirmText="Transferir"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isTransferring}
      />

      <ConfirmDialog
        isOpen={!!releaseConfirm}
        onClose={() => { setReleaseConfirm(null); setReleaseJustificativa(''); }}
        onConfirm={async () => {
          if (releaseConfirm) {
            const forcar = !!releaseConfirm.hasPresenca;
            await handleRemoverFuncionario(releaseConfirm.funcionarioId, releaseConfirm.nomeFuncionario, forcar);
            setReleaseConfirm(null);
            setReleaseJustificativa('');
          }
        }}
        title={releaseConfirm?.hasPresenca ? "Liberar funcionário (retroativo)" : "Liberar funcionário"}
        description={releaseConfirm
          ? releaseConfirm.hasPresenca
            ? `⚠️ ${releaseConfirm.nomeFuncionario} já possui presença registrada com horários. A liberação retroativa irá EXCLUIR os registros de presença existentes. Esta ação é irreversível. Informe a justificativa antes de confirmar.`
            : `Deseja remover ${releaseConfirm.nomeFuncionario} da lista de convocados desta solicitação? Ele ficará disponível para ser alocado em outra.`
          : ''
        }
        confirmText={releaseConfirm?.hasPresenca ? "Confirmar liberação retroativa" : "Liberar"}
        cancelText="Cancelar"
        variant={releaseConfirm?.hasPresenca ? "danger" : "warning"}
        confirmDisabled={!!releaseConfirm?.hasPresenca && releaseJustificativa.trim().length < 5}
      >
        {releaseConfirm?.hasPresenca && (
          <div className="mt-3">
            <label className="text-sm font-medium mb-1.5 block">Justificativa <span className="text-destructive">*</span></label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Informe o motivo da liberação retroativa (mínimo 5 caracteres)..."
              value={releaseJustificativa}
              onChange={(e) => setReleaseJustificativa(e.target.value)}
            />
            {releaseJustificativa.length > 0 && releaseJustificativa.trim().length < 5 && (
              <p className="text-xs text-destructive mt-1">Mínimo de 5 caracteres</p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
