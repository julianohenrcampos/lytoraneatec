import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, startOfWeek, endOfWeek, parseISO, eachDayOfInterval, isWeekend } from "date-fns";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, Loader2, Users, FileText, Check, ChevronRight, ChevronLeft, Info, Lock, User, Send, ClipboardCheck, AlertTriangle, Calendar, Shield } from "lucide-react";
import { SmartFuncionarioSearch, type ConflitoSelecao } from "./SmartFuncionarioSearch";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useDiariasDataScope } from "@/hooks/diarias";
import { RESTRICTED_CC_CODE } from "@/utils/centroCustoRestrictions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { lerConvocadosPre, derivarFuncionariosPlanos } from "@/lib/diarias/convocadosPreAdapter";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useFuncionariosBuscaAtivos,
  fetchFuncionariosAtivos,
  useFuncionarioElegibilidade,
  useMediaPresencaFds,
} from "@/hooks/diarias";
import type { SolicitacaoFormData, FuncionarioPreConvocado, DiariaSolicitacao } from "@/types/diarias";
import { useFeriadosPeriodo } from "@/hooks/diarias/useFeriados";
import { 
  analisarPeriodo, 
  calcularEstimativaTotal, 
  resumirPeriodoParaSimulacao,
  validarPeriodo,
  validarPeriodoNormal,
  primeiraDataValidaNormal,
  calcularJanelaSemanal,
  formatCurrency,
  podeParticiparDiaUtil,
  isAnteriorAHoje
} from "@/utils/diariasPeriodoUtils";
import { PeriodoResumo } from "./PeriodoResumo";
import { EstimativaAviso } from "./EstimativaAviso";
import { SimulacaoValores } from "./SimulacaoValores";
import {
  resolverRegraOperacional,
  salvarRegraCalendarioOperacional,
  inativarRegraCalendarioOperacionalEscopo,
  registrarLogOperacionalData,
  type CalendarioOperacionalResolvido,
} from "@/services/diarias/calendarioOperacionalService";
import { cn } from "@/lib/utils";

interface CentroCustoComAprovador {
  id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  aprovador_diarias_id: string | null;
}

interface FuncionarioOption {
  id: string;
  nome_completo: string;
  cpf?: string | null;
  funcao_id: string;
  centro_custo_id?: string | null;
  matricula?: string | null;
  status_funcionario?: string | null;
  email?: string | null;
  elegivel?: boolean;
  motivo_bloqueio?: string | null;
  fora_centro_custo_solicitacao?: boolean;
  bd_funcoes: {
    id: string;
    nome_funcao: string;
    valor_diaria: number;
    valor_diaria_exclusiva?: number | null;
    valor_refeicao?: number | null;
  } | null;
}

const FUNCAO_ENGENHARIA_REGEX = /(engenheiro|gerente regional)/i;
const FUNCAO_RESPONSAVEL_CAMPO_REGEX = /(apontador|encarregado|respons)/i;

const mergeFuncionarios = (...listas: Array<FuncionarioOption[] | undefined>) => {
  const map = new Map<string, FuncionarioOption>();

  listas
    .flat()
    .filter((item): item is FuncionarioOption => !!item?.id)
    .forEach((item) => {
      map.set(item.id, item);
    });

  return Array.from(map.values()).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));
};

const mapFuncionarioRecord = (funcionario: any): FuncionarioOption => ({
  id: funcionario.id,
  nome_completo: funcionario.nome_completo,
  cpf: funcionario.cpf ?? null,
  funcao_id: funcionario.funcao_id ?? '',
  centro_custo_id: funcionario.centro_custo_id ?? null,
  matricula: funcionario.matricula ?? null,
  status_funcionario: funcionario.status_funcionario ?? funcionario.status ?? null,
  email: funcionario.email ?? null,
  elegivel: funcionario.elegivel,
  motivo_bloqueio: funcionario.motivo_bloqueio ?? null,
  fora_centro_custo_solicitacao: funcionario.fora_centro_custo_solicitacao ?? false,
  bd_funcoes: funcionario.bd_funcoes
    ? {
        id: funcionario.bd_funcoes.id ?? funcionario.funcao_id ?? '',
        nome_funcao: funcionario.bd_funcoes.nome_funcao ?? '',
        valor_diaria: funcionario.bd_funcoes.valor_diaria ?? 0,
        valor_diaria_exclusiva: funcionario.bd_funcoes.valor_diaria_exclusiva ?? null,
        valor_refeicao: funcionario.bd_funcoes.valor_refeicao ?? null,
      }
    : (funcionario.funcao_nome
        ? {
            id: funcionario.funcao_id ?? '',
            nome_funcao: funcionario.funcao_nome,
            valor_diaria: funcionario.valor_diaria ?? 0,
            valor_diaria_exclusiva: funcionario.valor_diaria_exclusiva ?? null,
            valor_refeicao: funcionario.valor_refeicao ?? null,
          }
        : null),
});

interface SolicitacaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SolicitacaoFormData) => Promise<void>;
  onSaveAndSend?: (data: SolicitacaoFormData) => Promise<void>;
  editingSolicitacao?: DiariaSolicitacao | null;
  isSaving?: boolean;
}

type Step = 'dados' | 'funcionarios' | 'revisao';

export function SolicitacaoFormModal({
  isOpen,
  onClose,
  onSave,
  onSaveAndSend,
  editingSolicitacao,
  isSaving = false
}: SolicitacaoFormModalProps) {
  const JUSTIFICATIVA_OPERACIONAL_PADRAO = 'Ponte de feriado / estratégia operacional';
  const [step, setStep] = useState<Step>('dados');
  const { user } = useAuth();
  const { isSuperAdmin, permissions, userRole, hasActionPermission } = usePermission();
  const { scopeFilters, canCreateSolicitacao } = useDiariasDataScope();
  // RBAC: capacidade de criar solicitação retroativa (data anterior a hoje)
  const canCriarRetroativa = isSuperAdmin || hasActionPermission('diarias_solicitar', 'criar');
  
  // Form data - Período
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [consideraFdsFeriado, setConsideraFdsFeriado] = useState(false);
  
  // Novos campos - Período semanal e tipo
  const [tipoSolicitacao, setTipoSolicitacao] = useState<'normal' | 'extraordinaria'>('normal');
  const [justificativaExtraordinaria, setJustificativaExtraordinaria] = useState('');
  const [duplicidadeDetectada, setDuplicidadeDetectada] = useState<{ numero_solicitacao: string; id: string } | null>(null);
  
  const [centroCustoId, setCentroCustoId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [convocadosPre, setConvocadosPre] = useState<FuncionarioPreConvocado[]>([]);
  const [conflitoPendente, setConflitoPendente] = useState<ConflitoSelecao | null>(null);
  const [responsavelCampoId, setResponsavelCampoId] = useState('');
  const [engenheiroSolicitanteId, setEngenheiroSolicitanteId] = useState('');
  
  // Selection state for adding funcionarios
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [regrasOperacionaisPorData, setRegrasOperacionaisPorData] = useState<Record<string, CalendarioOperacionalResolvido>>({});
  const [diasOperacionaisSelecionados, setDiasOperacionaisSelecionados] = useState<string[]>([]);
  const [justificativaOperacional, setJustificativaOperacional] = useState(JUSTIFICATIVA_OPERACIONAL_PADRAO);
  const [isSavingRegrasOperacionais, setIsSavingRegrasOperacionais] = useState(false);
  const [regrasOperacionaisDirty, setRegrasOperacionaisDirty] = useState(false);
  const ultimoContextoRegrasCarregadoRef = useRef<string | null>(null);

  // Calcular semana automaticamente a partir da data início
  const semanaCalculada = useMemo(() => {
    if (!dataInicio) return null;
    const data = parseISO(dataInicio);
    const inicio = startOfWeek(data, { weekStartsOn: 1 });
    const fim = endOfWeek(data, { weekStartsOn: 1 });
    return {
      data_inicio_semana: format(inicio, 'yyyy-MM-dd'),
      data_fim_semana: format(fim, 'yyyy-MM-dd')
    };
  }, [dataInicio]);
  
  // Buscar feriados do período
  const { data: feriados = [] } = useFeriadosPeriodo(dataInicio, dataFim);
  
  // Analisar período em tempo real
  const analise = useMemo(() => {
    const feriadosFormatados = feriados.map(f => ({ data: f.data, nome: f.nome }));
    return analisarPeriodo(dataInicio, dataFim, feriadosFormatados, consideraFdsFeriado);
  }, [dataInicio, dataFim, feriados, consideraFdsFeriado]);

  // Auto-detectar se deve considerar FDS/Feriados baseado no período
  useEffect(() => {
    if (!dataInicio || !dataFim) return;
    const temFDS = analise.domingos > 0 || analise.sabados > 0;
    const temFeriado = analise.feriados > 0;
    const deveConsiderar = temFDS || temFeriado;
    setConsideraFdsFeriado(deveConsiderar);
  }, [dataInicio, dataFim, analise.domingos, analise.sabados, analise.feriados]);
  
  // Validar período
  const periodoValidacao = useMemo(() => {
    if ((tipoSolicitacao || 'normal') === 'normal') {
      return validarPeriodoNormal(dataInicio, dataFim, isSuperAdmin, !!editingSolicitacao);
    }
    return validarPeriodo(dataInicio, dataFim, 30, isSuperAdmin, !!editingSolicitacao);
  }, [dataInicio, dataFim, isSuperAdmin, editingSolicitacao, tipoSolicitacao]);

  const isEditing = !!editingSolicitacao;
  // Definição oficial de retroativa: data_inicio < hoje (data local).
  // Edição não exige justificativa de "criação retroativa".
  const isRetroativo = !isEditing && isAnteriorAHoje(dataInicio);
  const minJustificativa = isRetroativo ? 20 : 10;
  
  // Centro de custos query com fallback
  // D2.2 — queryKey inclui scopeFilters.centro_custo_ids para refetch quando o
  // escopo do AdmObra (multiobra) terminar de ser resolvido pelo hook.
  const scopedCcIds = scopeFilters.centro_custo_ids;
  const scopedCcKey = scopedCcIds ? [...scopedCcIds].sort().join(',') : null;
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-com-aprovador', isSuperAdmin, scopedCcKey],
    queryFn: async () => {
      let query = supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo, aprovador_diarias_id')
        .eq('situacao', 'Ativo');
      if (!isSuperAdmin) query = query.neq('codigo_centro_custo', RESTRICTED_CC_CODE);
      if (scopedCcIds?.length) query = query.in('id', scopedCcIds);
      const { data, error } = await query.order('nome_centro_custo');
      
      // Fallback se campo não existir (código de erro 42703)
      if (error && error.code === '42703') {
        let fallbackQuery = supabase
          .from('bd_centros_custo')
          .select('id, codigo_centro_custo, nome_centro_custo')
          .eq('situacao', 'Ativo');
        if (!isSuperAdmin) fallbackQuery = fallbackQuery.neq('codigo_centro_custo', RESTRICTED_CC_CODE);
        const { data: fallbackData } = await fallbackQuery.order('nome_centro_custo');
        return (fallbackData || []).map(cc => ({
          ...cc,
          aprovador_diarias_id: null
        })) as CentroCustoComAprovador[];
      }
      
      return (data as unknown as CentroCustoComAprovador[]) || [];
    }
  });

  // Adapta linhas vindas das RPCs (campos achatados) para o shape esperado por mapFuncionarioRecord
  const mapRpcRow = (row: any) => ({
    ...row,
    funcao_nome: row.nome_funcao,
  });

  // Busca server-side via RPC SECURITY DEFINER (get_funcionarios_ativos_global).
  // p_search filtra no banco; p_centro_custo prioriza CC do solicitante;
  // p_limit aplica cap absoluto. Substitui o legacy "carregar tudo".
  const queryClient = useQueryClient();
  const [funcSearch, setFuncSearch] = useState("");

  const {
    funcionarios: funcionariosServer,
    isFetching: isFetchingFuncionarios,
  } = useFuncionariosBuscaAtivos({
    search: funcSearch,
    centroCustoId: centroCustoId || null,
    limit: 50,
    enabled: isOpen && step === 'funcionarios',
  });

  // Headcount autoritativo do CC selecionado, sem p_search, para alimentar
  // a contagem do card de CC no SmartFuncionarioSearch. Não interfere na
  // lista de busca atual (queryKey distinta, sem search).
  const { funcionarios: funcionariosHeadcountCc } = useFuncionariosBuscaAtivos({
    search: "",
    centroCustoId: centroCustoId || null,
    limit: 500,
    enabled: isOpen && step === 'funcionarios' && !!centroCustoId,
  });

  // Cache de carregamento completo por CC (paginação alfabética client-side).
  // Contorna o cap rígido de 200 da RPC get_funcionarios_ativos_global, que
  // usa p_centro_custo apenas para ordenação. Reaproveitado pelo override
  // de contagem e pelo fluxo "Adicionar por CC".
  const [funcionariosFullCcCache, setFuncionariosFullCcCache] = useState<
    Record<string, any[]>
  >({});
  const [carregandoFullCc, setCarregandoFullCc] = useState<string | null>(null);

  const fetchTodosFuncionariosPorCC = useCallback(
    async (ccId: string): Promise<any[]> => {
      if (funcionariosFullCcCache[ccId]) return funcionariosFullCcCache[ccId];
      setCarregandoFullCc(ccId);
      try {
        // Cursor por letra: usa p_search como sondagem alfanumérica para
        // particionar o universo. Cada chamada retorna até 200 (cap RPC),
        // priorizando CC selecionado. Dedup por id ao final.
        const letras = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
        const acc = new Map<string, any>();
        const concorrencia = 4;

        for (let i = 0; i < letras.length; i += concorrencia) {
          const slice = letras.slice(i, i + concorrencia);
          const lotes = await Promise.all(
            slice.map((letra) =>
              fetchFuncionariosAtivos(queryClient, {
                centroCustoId: ccId,
                search: letra,
                limit: 200,
              }).catch((err) => {
                console.warn("[Diarias][fetchTodosFuncionariosPorCC] letra falhou", letra, err);
                return [] as any[];
              })
            )
          );
          for (const lote of lotes) {
            for (const f of lote) {
              if (f?.id && f.centro_custo_id === ccId && !acc.has(f.id)) {
                acc.set(f.id, f);
              }
            }
          }
        }

        const lista = Array.from(acc.values());
        setFuncionariosFullCcCache((prev) => ({ ...prev, [ccId]: lista }));
        return lista;
      } finally {
        setCarregandoFullCc((prev) => (prev === ccId ? null : prev));
      }
    },
    [funcionariosFullCcCache, queryClient]
  );

  // Pré-carrega o universo completo do CC ao entrar na etapa Funcionários,
  // para que o card de CC mostre a contagem real (sem o teto de 200) e o
  // botão "Adicionar por CC" responda instantaneamente.
  useEffect(() => {
    if (!isOpen || step !== 'funcionarios' || !centroCustoId) return;
    if (funcionariosFullCcCache[centroCustoId]) return;
    fetchTodosFuncionariosPorCC(centroCustoId).catch((err) =>
      console.warn("[Diarias][prefetchFullCC] erro", err)
    );
  }, [isOpen, step, centroCustoId, funcionariosFullCcCache, fetchTodosFuncionariosPorCC]);

  const totalFuncionariosPorCentroOverride = useMemo(() => {
    const m = new Map<string, number>();
    if (!centroCustoId) return m;
    const completo = funcionariosFullCcCache[centroCustoId];
    if (completo && completo.length > 0) {
      m.set(centroCustoId, completo.length);
    } else {
      const total = funcionariosHeadcountCc.filter(
        (f) => f.centro_custo_id === centroCustoId
      ).length;
      m.set(centroCustoId, total);
    }
    return m;
  }, [funcionariosFullCcCache, funcionariosHeadcountCc, centroCustoId]);

  // Aplica flag visual "fora do CC" e mantém compatibilidade de shape.
  const funcionarios = useMemo(() => {
    return funcionariosServer.map((f) => ({
      ...f,
      fora_centro_custo_solicitacao:
        !!centroCustoId && !!f.centro_custo_id && f.centro_custo_id !== centroCustoId,
    }));
  }, [funcionariosServer, centroCustoId]);

  const selectedCentroCusto = useMemo(() => {
    return centrosCusto.find((cc) => cc.id === centroCustoId);
  }, [centrosCusto, centroCustoId]);

  // D2.2 — Pré-seleção: se só houver 1 CC disponível (caso AdmObra com 1 obra)
  // e o usuário ainda não escolheu nenhum, seleciona automaticamente.
  // Não sobrescreve edição em curso nem seleção do usuário.
  useEffect(() => {
    if (!isOpen) return;
    if (editingSolicitacao) return;
    if (centroCustoId) return;
    if (centrosCusto.length === 1) {
      setCentroCustoId(centrosCusto[0].id);
    }
  }, [isOpen, editingSolicitacao, centroCustoId, centrosCusto]);

  const funcionarioIdsPreservados = useMemo(() => {
    return Array.from(new Set([
      responsavelCampoId,
      engenheiroSolicitanteId,
      selectedCentroCusto?.aprovador_diarias_id || '',
    ].filter(Boolean)));
  }, [responsavelCampoId, engenheiroSolicitanteId, selectedCentroCusto?.aprovador_diarias_id]);

  const { data: funcionariosPreservados = [] } = useQuery({
    queryKey: ['diarias-funcionarios-preservados', funcionarioIdsPreservados],
    queryFn: async () => {
      const { data: funcionariosData } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email, cpf, funcao_id, centro_custo_id, matricula, status, bd_funcoes(id, nome_funcao, valor_diaria, valor_diaria_exclusiva, valor_refeicao)')
        .in('id', funcionarioIdsPreservados)
        .order('nome_completo');

      return (funcionariosData || []).map(mapFuncionarioRecord);
    }
    ,
    enabled: isOpen && funcionarioIdsPreservados.length > 0,
  });


  const { data: engenheirosSolicitantes = [] } = useQuery({
    queryKey: ['diarias-engenheiros-solicitantes-rpc', funcionarioIdsPreservados],
    queryFn: async () => {
      // RPC SECURITY DEFINER: contorna RLS, retorna apenas campos operacionais (sem CPF/e-mail)
      const { data, error } = await supabase.rpc('get_engenheiros');
      if (error) {
        console.error('[Diarias][get_engenheiros] erro', error);
      }

      const base = (data || []).map(mapRpcRow).map(mapFuncionarioRecord);

      return mergeFuncionarios(
        base,
        funcionariosPreservados.filter((funcionario) => funcionario.id === engenheiroSolicitanteId || FUNCAO_ENGENHARIA_REGEX.test(funcionario.bd_funcoes?.nome_funcao || ''))
      );
    },
    enabled: isOpen,
  });

  const { data: responsaveisCampo = [] } = useQuery({
    queryKey: ['diarias-responsaveis-campo-rpc', centroCustoId, user?.id, funcionarioIdsPreservados],
    queryFn: async () => {
      if (!user?.id) {
        return mergeFuncionarios(
          funcionariosPreservados.filter((funcionario) => funcionario.id === responsavelCampoId)
        );
      }

      // RPC SECURITY DEFINER: SuperAdm/AdmRH recebem todos os ativos; AdmOBRA/AdmSede/Apontador
      // ficam restritos ao CC autorizado. Passamos null quando ainda não há CC selecionado.
      const { data, error } = await supabase.rpc('get_apontadores_por_cc', {
        p_user_id: user.id,
        p_centro_custo_id: centroCustoId || null,
      });
      if (error) {
        console.error('[Diarias][get_apontadores_por_cc] erro', error);
      }

      const base = (data || []).map(mapRpcRow).map(mapFuncionarioRecord);

      return mergeFuncionarios(
        base,
        funcionariosPreservados.filter((funcionario) => funcionario.id === responsavelCampoId)
      );
    },
    enabled: isOpen && !!user?.id,
  });

  const { data: aprovadorCentroCusto } = useQuery({
    queryKey: ['diarias-aprovador-centro-custo', selectedCentroCusto?.aprovador_diarias_id],
    queryFn: async () => {
      if (!selectedCentroCusto?.aprovador_diarias_id) return null;

      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email, cpf, funcao_id, centro_custo_id, matricula, status, bd_funcoes(id, nome_funcao, valor_diaria, valor_diaria_exclusiva, valor_refeicao)')
        .eq('id', selectedCentroCusto.aprovador_diarias_id)
        .maybeSingle();

      return data ? mapFuncionarioRecord(data) : null;
    },
    enabled: !!selectedCentroCusto?.aprovador_diarias_id,
  });

  // Dados do usuário logado (responsável pela solicitação)
  const { data: usuarioLogado } = useQuery({
    queryKey: ['usuario-logado-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, nome_completo, email')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  // Query alocações ativas para detectar conflitos
  const { data: alocacoesAtivas = [] } = useQuery({
    queryKey: ['alocacoes-ativas', dataInicio, dataFim],
    queryFn: async () => {
      if (!dataInicio || !dataFim) return [];
      const { data, error } = await supabase
        .from('bd_funcionarios_alocacoes' as any)
        .select('funcionario_id, solicitacao_id, centro_custo_id, data_inicio, data_fim')
        .eq('status', 'ativo')
        .lte('data_inicio', dataFim)
        .gte('data_fim', dataInicio);
      
      if (error) {
        console.error('Erro ao buscar alocações:', error);
        return [];
      }

      // Enrich with solicitacao number and centro custo code
      const enriched = [];
      for (const aloc of (data || [])) {
        const { data: sol } = await supabase
          .from('bd_diaria_solicitacoes')
          .select('numero_solicitacao')
          .eq('id', (aloc as any).solicitacao_id)
          .maybeSingle();
        const { data: cc } = await supabase
          .from('bd_centros_custo')
          .select('codigo_centro_custo')
          .eq('id', (aloc as any).centro_custo_id)
          .maybeSingle();
        enriched.push({
          ...(aloc as any),
          numero_solicitacao: sol?.numero_solicitacao || '',
          codigo_centro_custo: cc?.codigo_centro_custo || ''
        });
      }
      return enriched;
    },
    enabled: !!dataInicio && !!dataFim
  });

  // Map de alocações por funcionario_id para rápido acesso
  const alocacoesPorFuncionario = useMemo(() => {
    const map = new Map<string, { numero_solicitacao: string; codigo_centro_custo: string; solicitacao_id: string }>();
    for (const aloc of alocacoesAtivas) {
      // Excluir alocações da própria solicitação em edição
      if (editingSolicitacao && aloc.solicitacao_id === editingSolicitacao.id) continue;
      map.set(aloc.funcionario_id, {
        numero_solicitacao: aloc.numero_solicitacao,
        codigo_centro_custo: aloc.codigo_centro_custo,
        solicitacao_id: aloc.solicitacao_id
      });
    }
    return map;
  }, [alocacoesAtivas, editingSolicitacao]);

  const diasOperacionaisResumo = useMemo(() => {
    return diasOperacionaisSelecionados.map((data) => ({
      data,
      descricao: regrasOperacionaisPorData[data]?.descricao?.trim() || justificativaOperacional.trim(),
    }));
  }, [diasOperacionaisSelecionados, regrasOperacionaisPorData, justificativaOperacional]);

  const regrasOperacionaisSnapshot = useMemo(() => ({
    datas: Object.fromEntries(
      diasOperacionaisSelecionados.map((data) => {
        const regra = regrasOperacionaisPorData[data];
        return [data, {
          ativa: true,
          descricao: justificativaOperacional.trim(),
          exige_aprovacao_adicao: regra?.exigeAprovacaoAdicao ?? false,
          tipo: 'feriado_ponte_operacional' as const,
        }];
      })
    ),
    observacao: justificativaOperacional.trim(),
    classificacao: 'feriado_ponte_operacional' as const,
  }), [diasOperacionaisSelecionados, regrasOperacionaisPorData, justificativaOperacional]);

  const resumoSimulacaoPeriodo = useMemo(() => {
    return resumirPeriodoParaSimulacao(analise, regrasOperacionaisSnapshot, consideraFdsFeriado);
  }, [analise, regrasOperacionaisSnapshot, consideraFdsFeriado]);

  // Determinar se o período contém dias úteis (relevante para regra de Remessa)
  const temDiasUteis = useMemo(() => {
    return resumoSimulacaoPeriodo.diasUteis > 0;
  }, [resumoSimulacaoPeriodo.diasUteis]);

  // Manter compatibilidade
  const isSomenteDiasUteis = useMemo(() => {
    return analise.sabados === 0 && analise.domingos === 0 && analise.feriados === 0;
  }, [analise]);

  const datasPeriodo = useMemo(() => {
    if (!dataInicio || !dataFim || !periodoValidacao.valido) return [] as Array<{
      value: string;
      label: string;
      labelFull: string;
      isWeekend: boolean;
      isFeriado: boolean;
    }>;

    return eachDayOfInterval({ start: parseISO(dataInicio), end: parseISO(dataFim) }).map((date) => {
      const value = format(date, 'yyyy-MM-dd');
      const feriado = feriados.find((item) => item.data === value);
      return {
        value,
        label: format(date, 'dd'),
        labelFull: format(date, "EEEE, dd/MM", { locale: undefined }),
        isWeekend: isWeekend(date),
        isFeriado: !!feriado,
      };
    });
  }, [dataInicio, dataFim, feriados, periodoValidacao.valido]);

  const listaDiasGerados = datasPeriodo;
  const contextoRegrasOperacionais = useMemo(
    () => `${editingSolicitacao?.id || 'nova'}:${centroCustoId || 'sem-cc'}:${dataInicio || 'sem-inicio'}:${dataFim || 'sem-fim'}`,
    [editingSolicitacao?.id, centroCustoId, dataInicio, dataFim]
  );

  useEffect(() => {
    console.log(dataInicio, dataFim);
    console.log(listaDiasGerados);
  }, [dataInicio, dataFim, listaDiasGerados]);

  const sincronizarRegraOperacionalData = useCallback(async (data: string) => {
    const resolvida = await resolverRegraOperacional({
      data,
      centroCustoId: centroCustoId || null,
    });

    setRegrasOperacionaisPorData((prev) => ({
      ...prev,
      [data]: resolvida,
    }));

    return resolvida;
  }, [centroCustoId]);

  const carregarRegrasOperacionaisPeriodo = useCallback(async (force = false) => {
    if (!datasPeriodo.length || !centroCustoId) {
      setRegrasOperacionaisPorData({});
      setDiasOperacionaisSelecionados([]);
      setJustificativaOperacional(JUSTIFICATIVA_OPERACIONAL_PADRAO);
      setRegrasOperacionaisDirty(false);
      ultimoContextoRegrasCarregadoRef.current = null;
      return;
    }

    if (
      !force &&
      regrasOperacionaisDirty &&
      ultimoContextoRegrasCarregadoRef.current === contextoRegrasOperacionais
    ) {
      return;
    }

    const regrasEntries = await Promise.all(
      datasPeriodo.map(async (dataItem) => [
        dataItem.value,
        await resolverRegraOperacional({
          data: dataItem.value,
          centroCustoId,
        }),
      ] as const)
    );

    const regrasMap = Object.fromEntries(regrasEntries);
    const diasAtivos = regrasEntries
      .filter(([, regra]) => regra?.encontrada && regra.tipoDiaOperacional === 'operacional')
      .map(([data]) => data);
    const descricaoAtiva = regrasEntries.find(([, regra]) => regra?.descricao?.trim())?.[1].descricao?.trim();

    setRegrasOperacionaisPorData(regrasMap);
    setDiasOperacionaisSelecionados(diasAtivos);
    setJustificativaOperacional(diasAtivos.length > 0 ? (descricaoAtiva || JUSTIFICATIVA_OPERACIONAL_PADRAO) : JUSTIFICATIVA_OPERACIONAL_PADRAO);
    setRegrasOperacionaisDirty(false);
    ultimoContextoRegrasCarregadoRef.current = contextoRegrasOperacionais;
  }, [datasPeriodo, centroCustoId, contextoRegrasOperacionais, regrasOperacionaisDirty]);

  const alternarDiaOperacional = useCallback((data: string) => {
    setRegrasOperacionaisDirty(true);
    setDiasOperacionaisSelecionados((prev) => (
      prev.includes(data)
        ? prev.filter((item) => item !== data)
        : [...prev, data]
    ));
  }, []);

  const persistirRegrasOperacionaisSelecionadas = useCallback(async () => {
    if (!centroCustoId) return true;

    const justificativa = justificativaOperacional.trim();
    if (diasOperacionaisSelecionados.length > 0 && justificativa.length < 10) {
      toast.error('A justificativa da alteração precisa ter pelo menos 10 caracteres.');
      return false;
    }

    const selecionadosSet = new Set(diasOperacionaisSelecionados);
    const diasAtivosAtuais = Object.entries(regrasOperacionaisPorData)
      .filter(([, regra]) => regra?.encontrada && regra.tipoDiaOperacional === 'operacional')
      .map(([data]) => data);

    const diasParaDesativar = diasAtivosAtuais.filter((data) => !selecionadosSet.has(data));
    const diasParaAtivar = Array.from(selecionadosSet).filter((data) => {
      const regraAtual = regrasOperacionaisPorData[data];
      return !(
        regraAtual?.encontrada &&
        regraAtual.tipoDiaOperacional === 'operacional' &&
        regraAtual.usaDiariaExclusiva &&
        regraAtual.permiteRemessaMatriculados &&
        (regraAtual.descricao ?? '').trim() === justificativa
      );
    });

    if (!diasParaAtivar.length && !diasParaDesativar.length) return true;

    console.info('[Diarias][Regras operacionais] persistência iniciada', {
      centroCustoId,
      dataInicio,
      dataFim,
      diasOperacionaisSelecionados,
      diasParaAtivar,
      diasParaDesativar,
      payloadAtivacao: diasParaAtivar.map((data) => ({
        data,
        escopo_tipo: 'centro_custo',
        escopo_id: centroCustoId,
        tipo_dia_operacional: 'operacional',
        permite_remessa_matriculados: true,
        usa_diaria_exclusiva: true,
        exige_aprovacao_adicao: false,
        descricao: justificativa,
        ativo: true,
      })),
      payloadDesativacao: diasParaDesativar.map((data) => ({
        data,
        escopo_tipo: 'centro_custo',
        escopo_id: centroCustoId,
      })),
    });

    setIsSavingRegrasOperacionais(true);
    try {
      await Promise.all([
        ...diasParaAtivar.map(async (data) => {
          await salvarRegraCalendarioOperacional({
            data,
            escopo_tipo: 'centro_custo',
            escopo_id: centroCustoId,
            tipo_dia_operacional: 'operacional',
            permite_remessa_matriculados: true,
            usa_diaria_exclusiva: true,
            exige_aprovacao_adicao: false,
            descricao: justificativa,
            ativo: true,
          });

          await registrarLogOperacionalData({ data, acao: 'ativou', descricao: justificativa });
        }),
        ...diasParaDesativar.map(async (data) => {
          await inativarRegraCalendarioOperacionalEscopo({
            data,
            escopo_tipo: 'centro_custo',
            escopo_id: centroCustoId,
          });

          await registrarLogOperacionalData({
            data,
            acao: 'desativou',
            descricao: regrasOperacionaisPorData[data]?.descricao ?? 'Regra operacional removida na solicitação.',
          });
        }),
      ]);

      await carregarRegrasOperacionaisPeriodo(true);
      toast.success('Dias operacionais atualizados no período.');
      return true;
    } catch (error: any) {
      console.error('[Diarias][Regras operacionais] falha na persistência', {
        centroCustoId,
        dataInicio,
        dataFim,
        diasOperacionaisSelecionados,
        error,
      });
      toast.error(error.message || 'Erro ao atualizar os dias operacionais.');
      return false;
    } finally {
      setIsSavingRegrasOperacionais(false);
    }
  }, [centroCustoId, dataFim, dataInicio, diasOperacionaisSelecionados, justificativaOperacional, regrasOperacionaisPorData, carregarRegrasOperacionaisPeriodo]);

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      if (editingSolicitacao) {
        setDataInicio(editingSolicitacao.data_inicio);
        setDataFim(editingSolicitacao.data_fim);
        setConsideraFdsFeriado(editingSolicitacao.considera_fds_feriado || false);
        setCentroCustoId(editingSolicitacao.centro_custo_id);
        setJustificativa(editingSolicitacao.justificativa);
        setResponsavelCampoId(editingSolicitacao.responsavel_campo_id || '');
        setEngenheiroSolicitanteId(editingSolicitacao.engenheiro_solicitante_id || '');
        setTipoSolicitacao(editingSolicitacao.tipo_solicitacao || 'normal');
        setJustificativaExtraordinaria(editingSolicitacao.justificativa_extraordinaria || '');
        const convocadosNormalizados = derivarFuncionariosPlanos(
          lerConvocadosPre(editingSolicitacao.convocados_pre, {
            inicio: editingSolicitacao.data_inicio,
            fim: editingSolicitacao.data_fim,
          }),
        ).map((c) => {
          // Re-espalha `extras` no root para preservar campos legados
          // consumidos pelo form (ex.: `usar_diaria_exclusiva`).
          const { extras, ...rest } = c;
          return { ...(extras ?? {}), ...rest };
        });
        setConvocadosPre(convocadosNormalizados as any);
      } else {
        // Default da Normal: começa na primeira data válida não retroativa
        // (hoje para usuário comum quando estamos no meio da semana; segunda da semana
        //  corrente para SuperAdm) e termina no domingo da semana operacional.
        const inicioPadrao = primeiraDataValidaNormal(new Date(), isSuperAdmin);
        const fimPadrao = endOfWeek(inicioPadrao, { weekStartsOn: 1 });
        setDataInicio(format(inicioPadrao, 'yyyy-MM-dd'));
        setDataFim(format(fimPadrao, 'yyyy-MM-dd'));
        setConsideraFdsFeriado(false);
        setCentroCustoId('');
        setJustificativa('');
        setConvocadosPre([]);
        setResponsavelCampoId('');
        setEngenheiroSolicitanteId('');
        setTipoSolicitacao('normal');
        setJustificativaExtraordinaria('');
      }
      setStep('dados');
      setAttemptedNext(false);
      setDuplicidadeDetectada(null);
      setRegrasOperacionaisPorData({});
      setDiasOperacionaisSelecionados([]);
      setJustificativaOperacional(JUSTIFICATIVA_OPERACIONAL_PADRAO);
      setRegrasOperacionaisDirty(false);
      ultimoContextoRegrasCarregadoRef.current = null;
    }
  }, [isOpen, editingSolicitacao]);

  useEffect(() => {
    void carregarRegrasOperacionaisPeriodo();
  }, [carregarRegrasOperacionaisPeriodo]);

  // Verificar duplicidade por sobreposição de datas + centro de custo
  useEffect(() => {
    if (!centroCustoId || !dataInicio || !dataFim || isEditing) {
      setDuplicidadeDetectada(null);
      return;
    }
    const checkDuplicate = async () => {
      const { data } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('id, numero_solicitacao')
        .eq('centro_custo_id', centroCustoId)
        .lte('data_inicio', dataFim)
        .gte('data_fim', dataInicio)
        .neq('status', 'cancelado')
        .limit(1);
      if (data && data.length > 0) {
        setDuplicidadeDetectada({ numero_solicitacao: data[0].numero_solicitacao, id: data[0].id });
      } else {
        setDuplicidadeDetectada(null);
      }
    };
    checkDuplicate();
  }, [centroCustoId, dataInicio, dataFim, isEditing]);

  // Get aprovador name
  // Get apontador name
  const apontadorNome = useMemo(() => {
    if (!responsavelCampoId) return null;
    const func = mergeFuncionarios(responsaveisCampo, funcionariosPreservados, funcionarios).find((f) => f.id === responsavelCampoId);
    return func?.nome_completo || null;
  }, [responsavelCampoId, responsaveisCampo, funcionariosPreservados, funcionarios]);

  const aprovadorNome = useMemo(() => {
    if (!selectedCentroCusto?.aprovador_diarias_id) return null;
    return aprovadorCentroCusto?.nome_completo
      || funcionariosPreservados.find((f) => f.id === selectedCentroCusto.aprovador_diarias_id)?.nome_completo
      || 'Aprovador não encontrado';
  }, [selectedCentroCusto, aprovadorCentroCusto, funcionariosPreservados]);

  // Lista filtrada para Engenheiro Solicitante (apenas engenheiros e gerentes regionais)
  const engenheirosEGerentes = useMemo(() => {
    return mergeFuncionarios(
      engenheirosSolicitantes,
      funcionariosPreservados.filter((funcionario) => funcionario.id === engenheiroSolicitanteId)
    );
  }, [engenheirosSolicitantes, funcionariosPreservados, engenheiroSolicitanteId]);

  const funcionariosBusca = useMemo(() => {
    const merged = mergeFuncionarios(funcionarios, funcionariosPreservados);

    const normalized = merged.map((funcionario) => ({
      ...funcionario,
      bd_funcoes: funcionario.bd_funcoes
        ? {
            id: funcionario.bd_funcoes.id || funcionario.funcao_id,
            nome_funcao: funcionario.bd_funcoes.nome_funcao || 'Sem função cadastrada',
            valor_diaria: funcionario.bd_funcoes.valor_diaria ?? 0,
            valor_diaria_exclusiva: funcionario.bd_funcoes.valor_diaria_exclusiva ?? null,
            valor_refeicao: funcionario.bd_funcoes.valor_refeicao ?? null,
          }
        : null,
    }));

    console.info('[Diarias][busca server-side]', {
      search: funcSearch,
      centroCustoId,
      totalServer: funcionarios.length,
      totalPreservados: funcionariosPreservados.length,
      totalFinal: normalized.length,
    });

    return normalized;
  }, [funcionarios, funcionariosPreservados, dataInicio, dataFim, funcSearch, centroCustoId]);

  // Elegibilidade 3 estados (livre / alerta / bloqueado) para os funcionários visíveis.
  // Bloqueado é regra dura (ignora forceAdd). Alerta abre confirmação.
  const idsVisiveisElegibilidade = useMemo(
    () => funcionariosBusca.map((f) => f.id),
    [funcionariosBusca]
  );
  const { elegibilidadeMap } = useFuncionarioElegibilidade({
    funcionarioIds: idsVisiveisElegibilidade,
    dataInicio,
    dataFim,
    solicitacaoId: editingSolicitacao?.id || null,
    enabled: isOpen && step === 'funcionarios' && idsVisiveisElegibilidade.length > 0,
  });

  // Add funcionario by ID (used by SmartSearch)
  // forceAdd=true permite ignorar o bloqueio elegivel=false quando o usuário
  // já confirmou explicitamente um conflito operacional via diálogo.
  const handleAddFuncionarioById = async (funcId: string, forceAdd: boolean = false) => {
    const func = funcionariosBusca.find((f: any) => f.id === funcId) || funcionarios.find((f: any) => f.id === funcId);
    if (!func) return;
    
    if (convocadosPre.some(c => c.funcionario_id === funcId)) {
      toast.warning("Este funcionário já está na lista.");
      return;
    }

    if (!func.bd_funcoes) {
      toast.warning(`${func.nome_completo} não possui função cadastrada.`);
      return;
    }

    // Regra dura: bloqueado pela RPC de elegibilidade NUNCA passa, ignora forceAdd.
    const eleg = elegibilidadeMap.get(funcId);
    if (eleg?.status === 'bloqueado') {
      toast.error(eleg.motivo || `${func.nome_completo} está bloqueado para o período.`);
      return;
    }

    // Legacy/compat: elegivel=false sem confirmação ainda exige forceAdd.
    if (!forceAdd && (func.elegivel === false || eleg?.status === 'alerta')) {
      toast.warning(eleg?.alertaMensagem || eleg?.motivo || func.motivo_bloqueio || `${func.nome_completo} requer confirmação.`);
      return;
    }

    const novoConvocado: FuncionarioPreConvocado = {
      funcionario_id: func.id,
      funcao_id: func.funcao_id,
      valor_diaria: func.bd_funcoes.valor_diaria || 0,
      valor_diaria_exclusiva: func.bd_funcoes.valor_diaria_exclusiva || undefined,
      valor_refeicao: func.bd_funcoes.valor_refeicao || 0,
      nome_funcionario: func.nome_completo,
      nome_funcao: func.bd_funcoes.nome_funcao,
      cpf: func.cpf || '',
      matricula: func.matricula || ''
    };

    setConvocadosPre([...convocadosPre, novoConvocado]);
    toast.success(`${func.nome_completo} adicionado.`);
  };

  // Estado da confirmação "Adicionar por CC" quando volume é grande.
  const [pendingCcAdd, setPendingCcAdd] = useState<{ ccId: string; preview: number } | null>(null);

  // Adiciona uma lista de candidatos (já vinda do servidor) ao convocadosPre.
  // Filtros aplicados:
  //   - guard de CC alvo (descarta funcionários fora do CC selecionado);
  //   - funcionário já presente na lista;
  //   - sem função cadastrada (impede cálculo financeiro).
  // NÃO bloqueia inclusão por elegibilidade: funcionários com matrícula
  // inelegíveis em dia útil DEVEM entrar na lista da solicitação. A
  // elegibilidade controla apenas o Apontamento de Campo (entrada/saída),
  // não a presença do funcionário na solicitação.
  const aplicarLoteFuncionarios = useCallback((lista: any[], ccAlvoId?: string) => {
    const addedIds = new Set(convocadosPre.map((c) => c.funcionario_id));
    const novos: FuncionarioPreConvocado[] = [];
    let jaExistentes = 0;
    let semFuncao = 0;
    let foraCc = 0;
    const totalEncontrados = lista.length;

    for (const func of lista) {
      if (ccAlvoId && func.centro_custo_id !== ccAlvoId) { foraCc++; continue; }
      if (addedIds.has(func.id)) { jaExistentes++; continue; }
      if (!func.bd_funcoes) { semFuncao++; continue; }

      novos.push({
        funcionario_id: func.id,
        funcao_id: func.funcao_id,
        valor_diaria: func.bd_funcoes.valor_diaria || 0,
        valor_diaria_exclusiva: func.bd_funcoes.valor_diaria_exclusiva || undefined,
        valor_refeicao: func.bd_funcoes.valor_refeicao || 0,
        nome_funcionario: func.nome_completo,
        nome_funcao: func.bd_funcoes.nome_funcao,
        cpf: func.cpf || '',
        matricula: func.matricula || '',
      });
    }

    if (novos.length > 0) setConvocadosPre([...convocadosPre, ...novos]);

    const elegiveis = totalEncontrados - foraCc - semFuncao;
    const resumo = [
      `Encontrados no CC: ${totalEncontrados - foraCc}`,
      `Elegíveis: ${elegiveis}`,
      `Adicionados: ${novos.length}`,
      `Já na lista: ${jaExistentes}`,
      `Sem função: ${semFuncao}`,
    ];
    if (foraCc > 0) resumo.push(`Fora do CC: ${foraCc}`);

    const mensagem = resumo.join(' • ');

    if (novos.length > 0) toast.success(mensagem);
    else if (jaExistentes > 0) toast.info(mensagem);
    else toast.warning(mensagem);
  }, [convocadosPre]);

  // "Adicionar por CC" — usa o cache completo paginado para superar o cap de
  // 200 da RPC. fetchTodosFuncionariosPorCC já filtra por CC e deduplica.
  const handleAddByCentroCusto = async (centroCustoIdSelected: string) => {
    try {
      // Tenta usar o cache pré-carregado; se vazio, faz a paginação completa.
      const cached = funcionariosFullCcCache[centroCustoIdSelected];
      const lista = cached ?? (await fetchTodosFuncionariosPorCC(centroCustoIdSelected));

      // Volume baixo (< 100) — adiciona direto, sem confirmação.
      if (lista.length < 100) {
        aplicarLoteFuncionarios(lista, centroCustoIdSelected);
        return;
      }

      // Volume alto — confirma com contagem real (já paginada, sem teto de 200).
      setPendingCcAdd({ ccId: centroCustoIdSelected, preview: lista.length });
    } catch (err) {
      console.error('[Diarias][addByCC] erro', err);
      toast.error('Não foi possível carregar os funcionários do centro de custo.');
    }
  };

  const confirmarAddByCc = async () => {
    if (!pendingCcAdd) return;
    const { ccId } = pendingCcAdd;
    setPendingCcAdd(null);
    try {
      const lista = await fetchTodosFuncionariosPorCC(ccId);
      aplicarLoteFuncionarios(lista, ccId);
    } catch (err) {
      console.error('[Diarias][addByCC confirm] erro', err);
      toast.error('Não foi possível carregar a lista completa.');
    }
  };

  // Remove funcionario
  const handleRemoveFuncionario = (funcionarioId: string) => {
    setConvocadosPre(convocadosPre.filter(c => c.funcionario_id !== funcionarioId));
  };

  // Toggle tipo de diária por funcionário
  const handleTipoDiariaChange = (funcionarioId: string, usarExclusiva: boolean) => {
    setConvocadosPre(prev => prev.map(c => 
      c.funcionario_id === funcionarioId 
        ? { ...c, usar_diaria_exclusiva: usarExclusiva }
        : c
    ));
  };

  // Base histórica de presenças em FDS para refinar a estimativa de refeições
  // de fim de semana (objetivo 3). Usa apenas o ÚLTIMO sábado/domingo
  // anteriores ao período da solicitação, restrito ao CC.
  const { data: mediaFds } = useMediaPresencaFds(centroCustoId, {
    enabled: isOpen && step === 'funcionarios' && !!centroCustoId,
    periodoInicio: dataInicio || null,
  });

  // Calculate simulação de valores
  const simulacao = useMemo(() => {
    const base = calcularEstimativaTotal(convocadosPre, analise, consideraFdsFeriado, tipoSolicitacao, regrasOperacionaisSnapshot);

    // Override de FDS quando há histórico real do CC no último FDS encontrado.
    // A base histórica passa a alimentar TANTO as diárias FDS QUANTO as refeições FDS.
    // Dias úteis (diárias e refeições) permanecem inalterados — vindos da lista convocada.
    if (
      mediaFds &&
      mediaFds.fonte === 'ultimo_fds' &&
      consideraFdsFeriado &&
      convocadosPre.length > 0 &&
      (resumoSimulacaoPeriodo.sabados > 0 ||
        resumoSimulacaoPeriodo.domingos > 0 ||
        resumoSimulacaoPeriodo.feriados > 0 ||
        resumoSimulacaoPeriodo.diasOperacionais > 0)
    ) {
      // Fonte de valores médios: lista atual primeiro, depois cache do CC.
      const cacheCc = centroCustoId ? funcionariosFullCcCache[centroCustoId] : undefined;

      const refeicoesLista = convocadosPre.map((c) => c.valor_refeicao || 0).filter((v) => v > 0);
      const refeicoesCc = (cacheCc || [])
        .map((f: any) => f?.bd_funcoes?.valor_refeicao || 0)
        .filter((v: number) => v > 0);
      const fonteRefeicoes = refeicoesLista.length > 0 ? refeicoesLista : refeicoesCc;
      const valorMedioRefeicao =
        fonteRefeicoes.length > 0
          ? fonteRefeicoes.reduce((s, n) => s + n, 0) / fonteRefeicoes.length
          : 0;

      const exclusivaLista = convocadosPre
        .map((c) => c.valor_diaria_exclusiva || (c.valor_diaria ? c.valor_diaria * 1.2 : 0))
        .filter((v) => v > 0);
      const exclusivaCc = (cacheCc || [])
        .map((f: any) => {
          const fn = f?.bd_funcoes;
          const ex = fn?.valor_diaria_exclusiva || 0;
          if (ex > 0) return ex;
          const dn = fn?.valor_diaria || 0;
          return dn > 0 ? dn * 1.2 : 0;
        })
        .filter((v: number) => v > 0);
      const fonteExclusiva = exclusivaLista.length > 0 ? exclusivaLista : exclusivaCc;
      const valorMedioDiariaExclusiva =
        fonteExclusiva.length > 0
          ? fonteExclusiva.reduce((s, n) => s + n, 0) / fonteExclusiva.length
          : 0;

      // Bases por dia: usa contagem própria do dia se houver, senão a média.
      const baseSab = mediaFds.sabadoAnteriorCount ?? mediaFds.mediaFimSemanaAnterior;
      const baseDom = mediaFds.domingoAnteriorCount ?? mediaFds.mediaFimSemanaAnterior;
      const baseOutrosExclusivos = mediaFds.mediaFimSemanaAnterior; // feriados/dias operacionais

      if (baseSab === 0 && baseDom === 0) {
        return {
          ...base,
          _fonteRefeicaoFds: 'fallback' as const,
        } as typeof base & { _fonteRefeicaoFds?: 'ultimo_fds' | 'fallback' };
      }

      const qtdSab = resumoSimulacaoPeriodo.sabados;
      const qtdDom = resumoSimulacaoPeriodo.domingos;
      const qtdOutros = resumoSimulacaoPeriodo.feriados + resumoSimulacaoPeriodo.diasOperacionais;
      const qtdDiasUteis = resumoSimulacaoPeriodo.diasUteis;

      // === DIAS ÚTEIS — ISOLADO, regra original ===
      // Não sofre nenhum ajuste pela média histórica de FDS.
      // Replica a mesma lógica original APENAS para dias úteis:
      //  - matrícula && tipo != 'extraordinaria' && !usar_diaria_exclusiva ⇒ bloqueado em úteis
      //  - quem usa exclusiva paga valor_diaria_exclusiva (ou valor_diaria*1.2) também nos úteis
      let totalDiasUteisOriginal = 0;
      let refeicoesDiasUteisOriginal = 0;
      for (const c of convocadosPre) {
        const temMatricula = !!c.matricula;
        const forcarExclusiva = (c as any).usar_diaria_exclusiva === true;
        const bloqueado =
          temMatricula && tipoSolicitacao !== 'extraordinaria' && !forcarExclusiva;
        const dias = bloqueado ? 0 : qtdDiasUteis;
        const valorDiariaUtil = forcarExclusiva
          ? (c.valor_diaria_exclusiva || (c.valor_diaria ? c.valor_diaria * 1.2 : 0))
          : (c.valor_diaria || 0);
        totalDiasUteisOriginal += dias * valorDiariaUtil;
        refeicoesDiasUteisOriginal += dias * (c.valor_refeicao || 0);
      }

      // === FDS/FERIADOS — base histórica × valor exclusiva ===
      const totalFdsHistorico =
        (baseSab * qtdSab + baseDom * qtdDom + baseOutrosExclusivos * qtdOutros) *
        valorMedioDiariaExclusiva;

      // === REFEIÇÕES FDS — base histórica × valor refeição ===
      const refeicoesFdsHistorico =
        (baseSab * qtdSab + baseDom * qtdDom + baseOutrosExclusivos * qtdOutros) *
        valorMedioRefeicao;

      const novoTotalRefeicoes = refeicoesDiasUteisOriginal + refeicoesFdsHistorico;
      const novoTotalEstimado =
        totalDiasUteisOriginal + totalFdsHistorico + novoTotalRefeicoes;

      return {
        ...base,
        totalDiasUteisESabados: totalDiasUteisOriginal, // somente úteis (sábado sai daqui)
        totalDomFeriados: totalFdsHistorico,            // sáb + dom + feriados/operacionais via histórico
        totalRefeicoes: novoTotalRefeicoes,
        totalEstimado: novoTotalEstimado,
        // aliases deprecados mantidos coerentes
        totalDiasUteis: totalDiasUteisOriginal,
        totalFdsFeriados: totalFdsHistorico,
        _fonteRefeicaoFds: 'ultimo_fds' as const,
        _sabadoAnteriorCount: mediaFds.sabadoAnteriorCount,
        _domingoAnteriorCount: mediaFds.domingoAnteriorCount,
        _datasFdsConsideradas: mediaFds.datasConsideradas,
        _qtdFdsUsados: mediaFds.qtdFdsUsados,
        _fdsRecentes: mediaFds.fdsRecentes,
      } as typeof base & {
        _fonteRefeicaoFds?: 'ultimo_fds' | 'fallback';
        _sabadoAnteriorCount?: number | null;
        _domingoAnteriorCount?: number | null;
        _datasFdsConsideradas?: { sabado: string | null; domingo: string | null };
        _qtdFdsUsados?: number;
        _fdsRecentes?: Array<{ sabado: string; domingo: string; qtdSab: number; qtdDom: number }>;
      };
    }

    return {
      ...base,
      _fonteRefeicaoFds: 'fallback' as const,
    } as typeof base & { _fonteRefeicaoFds?: 'ultimo_fds' | 'fallback' };
  }, [convocadosPre, analise, consideraFdsFeriado, tipoSolicitacao, regrasOperacionaisSnapshot, mediaFds, resumoSimulacaoPeriodo, centroCustoId, funcionariosFullCcCache]);

  // Validation
  const isExtraordinariaValida = tipoSolicitacao === 'normal' || (tipoSolicitacao === 'extraordinaria' && justificativaExtraordinaria.trim().length >= 20);
  const justificativaRetroativaOk = !isRetroativo || isEditing || justificativa.trim().length >= 20;
  const canProceedToDados = dataInicio && dataFim && centroCustoId && periodoValidacao.valido && responsavelCampoId && engenheiroSolicitanteId && !duplicidadeDetectada && isExtraordinariaValida && justificativaRetroativaOk;
  const canProceedToFuncionarios = convocadosPre.length > 0 && justificativa.trim().length >= minJustificativa;
  const canSave = canProceedToDados && canProceedToFuncionarios;
  const justificativaOperacionalInvalida = diasOperacionaisSelecionados.length > 0 && justificativaOperacional.trim().length < 10;

  // Build form data
  const buildFormData = (): SolicitacaoFormData => ({
    data_inicio: dataInicio,
    data_fim: dataFim,
    data_inicio_semana: semanaCalculada?.data_inicio_semana,
    data_fim_semana: semanaCalculada?.data_fim_semana,
    tipo_solicitacao: tipoSolicitacao,
    flag_extraordinaria: tipoSolicitacao === 'extraordinaria',
    justificativa_extraordinaria: tipoSolicitacao === 'extraordinaria' ? justificativaExtraordinaria : undefined,
    centro_custo_id: centroCustoId,
    justificativa,
    considera_fds_feriado: consideraFdsFeriado,
    qtde_dias_uteis_estimado: resumoSimulacaoPeriodo.diasUteis,
    qtde_fds_estimado: resumoSimulacaoPeriodo.sabados + resumoSimulacaoPeriodo.domingos + resumoSimulacaoPeriodo.diasOperacionais,
    qtde_feriados_estimado: resumoSimulacaoPeriodo.feriados,
    valor_estimado_total: simulacao.totalEstimado,
    convocados_pre: convocadosPre.map(c => ({
      funcionario_id: c.funcionario_id,
      funcao_id: c.funcao_id,
      valor_diaria: c.valor_diaria,
      valor_diaria_exclusiva: c.valor_diaria_exclusiva,
      valor_refeicao: c.valor_refeicao,
      nome_funcionario: c.nome_funcionario,
      nome_funcao: c.nome_funcao,
      usar_diaria_exclusiva: c.usar_diaria_exclusiva || false,
      cpf: c.cpf,
      matricula: c.matricula
    })),
    responsavel_campo_id: responsavelCampoId || undefined,
    engenheiro_solicitante_id: engenheiroSolicitanteId || undefined,
    regras_operacionais_por_data: regrasOperacionaisSnapshot
  });

  // Log de auditoria para extraordinárias
  const logExtraordinaria = async (solicitacaoId: string) => {
    if (tipoSolicitacao !== 'extraordinaria' || !user?.id) return;
    try {
      await supabase.from('bd_diaria_logs' as any).insert({
        solicitacao_id: solicitacaoId,
        tipo_evento: 'CRIACAO_EXTRAORDINARIA',
        usuario_id: user.id,
        justificativa: justificativaExtraordinaria,
        dados_extras: { tipo_solicitacao: 'extraordinaria' }
      });
    } catch (e) { /* silencioso */ }
  };

  // Handle save as draft
  const handleSave = async () => {
    const payload = buildFormData();

    console.info('[Diarias][Modal] salvar rascunho', {
      userId: user?.id || null,
      canCreateSolicitacao,
      permissions,
      payload,
    });

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  // Handle save and send for authorization
  const handleSaveAndSend = async () => {
    const payload = buildFormData();

    console.info('[Diarias][Modal] salvar e enviar', {
      userId: user?.id || null,
      canCreateSolicitacao,
      permissions,
      payload,
    });

    try {
      if (onSaveAndSend) {
        await onSaveAndSend(payload);
        onClose();
      }
    } catch (error) {
      console.error('Erro ao salvar e enviar:', error);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>
            {editingSolicitacao ? 'Editar Solicitação' : 'Nova Solicitação de Diária'}
          </DialogTitle>
          <DialogDescription>
            {step === 'dados' && 'Defina o período e centro de custo da solicitação.'}
            {step === 'funcionarios' && 'Selecione os funcionários que participarão.'}
            {step === 'revisao' && 'Revise os dados e valores estimados.'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Badge variant={step === 'dados' ? 'default' : 'secondary'} className="gap-1">
            <FileText className="h-3 w-3" />
            Dados
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'funcionarios' ? 'default' : 'secondary'} className="gap-1">
            <Users className="h-3 w-3" />
            Funcionários
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'revisao' ? 'default' : 'secondary'} className="gap-1">
            <Check className="h-3 w-3" />
            Revisão
          </Badge>
        </div>

        <div className="overflow-y-auto max-h-[60vh] pr-4">
          {/* Step 1: Dados Básicos */}
          {step === 'dados' && (
            <div className="space-y-4">
              {/* Período */}
              <div className="space-y-2">
                <Label>Período da Solicitação *</Label>
                <p className="text-xs text-muted-foreground">
                  {(tipoSolicitacao || 'normal') === 'normal' ? (
                    <>
                      Escolha qualquer dia da semana desejada — o sistema fixa o domingo como Data Fim.
                      Para a semana atual, a Data Início começa em <strong>hoje</strong> (ou na primeira data válida não retroativa).
                    </>
                  ) : (
                    <>Período Extraordinário: pode haver mais de uma solicitação na mesma semana e centro de custo.</>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Início</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      min={!isSuperAdmin ? format(primeiraDataValidaNormal(new Date(), false), 'yyyy-MM-dd') : undefined}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (!raw) {
                          setDataInicio('');
                          setDataFim('');
                          return;
                        }
                        const escolhida = parseISO(raw);
                        const domingo = endOfWeek(escolhida, { weekStartsOn: 1 });

                        if (isSuperAdmin) {
                          // SuperAdm: aceita literalmente a data escolhida (mesmo retroativa).
                          setDataInicio(format(escolhida, 'yyyy-MM-dd'));
                          setDataFim(format(domingo, 'yyyy-MM-dd'));
                          return;
                        }

                        // Usuário comum: snap para a mínima (hoje) se tentar retroativo.
                        const minima = primeiraDataValidaNormal(new Date(), false);
                        if (escolhida < minima) {
                          toast.warning('Somente SuperAdm pode criar Solicitação de Diária retroativa.');
                        }
                        const inicioReal = escolhida < minima ? minima : escolhida;
                        setDataInicio(format(inicioReal, 'yyyy-MM-dd'));
                        setDataFim(format(endOfWeek(inicioReal, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                      }}
                      disabled={isEditing}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Fim (Domingo)</Label>
                    <Input
                      type="date"
                      value={dataFim}
                      readOnly
                      disabled
                      tabIndex={-1}
                      className="cursor-not-allowed bg-muted"
                    />
                  </div>
                </div>
                {isEditing && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Período bloqueado na edição. Esta correção permite apenas ajustar responsáveis e dados da solicitação.
                  </p>
                )}
               {!periodoValidacao.valido && periodoValidacao.erro && (
                  <p className="text-sm text-destructive">{periodoValidacao.erro}</p>
                )}
                {isRetroativo && isSuperAdmin && !isEditing && (
                  <div className="space-y-2 p-3 border border-amber-300 bg-amber-50 rounded-md">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-amber-800 text-xs">
                        <strong>Solicitação Retroativa (SuperAdm):</strong> Você selecionou uma data anterior a hoje. Justifique abaixo (mínimo 20 caracteres).
                      </div>
                    </div>
                    <Label htmlFor="justificativa-retroativa-step1" className="sr-only">
                      Justificativa para criação retroativa
                    </Label>
                    <Textarea
                      id="justificativa-retroativa-step1"
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Explique o motivo da criação retroativa desta solicitação..."
                      rows={3}
                    />
                    <p className="text-xs text-amber-800">
                      {justificativa.trim().length}/20 caracteres mínimos
                    </p>
                  </div>
                )}
               </div>

              {/* Semana Calculada */}
              {semanaCalculada && periodoValidacao.valido && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Semana de referência</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBrazilianDateForDisplay(semanaCalculada.data_inicio_semana)} (Seg) — {formatBrazilianDateForDisplay(semanaCalculada.data_fim_semana)} (Dom)
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">Automático</Badge>
                </div>
              )}

              {dataInicio && dataFim && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div>
                    <Label>Configuração dos dias do período</Label>
                    <p className="text-xs text-muted-foreground">Selecione os dias que devem ser tratados como feriado/ponte operacional.</p>
                  </div>
                  {listaDiasGerados.length > 0 ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                        {listaDiasGerados.map((dia) => {
                          const selecionado = diasOperacionaisSelecionados.includes(dia.value);
                          return (
                            <button
                              key={dia.value}
                              type="button"
                              onClick={() => alternarDiaOperacional(dia.value)}
                              className={cn(
                                "flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
                                selecionado
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-border bg-muted text-foreground hover:bg-accent",
                              )}
                            >
                              {dia.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="justificativa-operacional">Justificativa da alteração *</Label>
                        <Textarea
                          id="justificativa-operacional"
                          value={justificativaOperacional}
                          onChange={(e) => {
                            setRegrasOperacionaisDirty(true);
                            setJustificativaOperacional(e.target.value);
                          }}
                          placeholder={JUSTIFICATIVA_OPERACIONAL_PADRAO}
                          rows={3}
                          className="min-h-[88px]"
                        />
                        {diasOperacionaisSelecionados.length > 0 && justificativaOperacional.trim().length < 10 && (
                          <p className="text-xs text-destructive">
                            Informe ao menos 10 caracteres para aplicar os dias selecionados.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Selecione um período válido para gerar os dias automaticamente.
                    </p>
                  )}
                </div>
              )}

              {/* Alerta de Duplicidade */}
              {duplicidadeDetectada && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Já existe uma solicitação aberta para este Centro de Custo neste período.</p>
                    <p className="text-xs mt-1">
                      Solicitação Nº <strong>{duplicidadeDetectada.numero_solicitacao}</strong> — Para incluir novos funcionários, utilize o Apontamento de Campo.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Tipo de Solicitação */}
              <div className="space-y-3 p-3 border rounded-lg">
                <Label className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Tipo de Solicitação
                </Label>
                <RadioGroup
                  value={tipoSolicitacao}
                  onValueChange={(v) => setTipoSolicitacao(v as 'normal' | 'extraordinaria')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="tipo-normal" />
                    <Label htmlFor="tipo-normal" className="cursor-pointer">Normal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="extraordinaria" id="tipo-extra" />
                    <Label htmlFor="tipo-extra" className="cursor-pointer text-amber-700">Extraordinária</Label>
                  </div>
                </RadioGroup>

                {tipoSolicitacao === 'extraordinaria' && (
                  <div className="space-y-2">
                    <Alert className="border-amber-300 bg-amber-50">
                      <Shield className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-xs">
                        Solicitações extraordinárias liberam funcionários registrados em qualquer dia e são auditadas.
                      </AlertDescription>
                    </Alert>
                    <div>
                      <Label className="text-sm">Justificativa Extraordinária <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={justificativaExtraordinaria}
                        onChange={(e) => setJustificativaExtraordinaria(e.target.value)}
                        placeholder="Explique o motivo da solicitação extraordinária (mín. 20 caracteres)..."
                        className="mt-1"
                        rows={2}
                      />
                      {justificativaExtraordinaria.length > 0 && justificativaExtraordinaria.length < 20 && (
                        <p className="text-xs text-destructive mt-1">
                          Mínimo 20 caracteres ({justificativaExtraordinaria.length}/20)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Indicador automático FDS/Feriados */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Finais de semana e feriados
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {consideraFdsFeriado 
                      ? 'Detectado automaticamente — FDS/feriados incluídos no cálculo'
                      : 'Período contém apenas dias úteis — sem FDS/feriados'}
                  </p>
                </div>
                <Badge variant={consideraFdsFeriado ? 'default' : 'outline'}>
                  {consideraFdsFeriado ? 'Incluso' : 'N/A'}
                </Badge>
              </div>
              
              {/* Resumo do Período */}
              {periodoValidacao.valido && (
                <PeriodoResumo
                  dataInicio={dataInicio}
                  dataFim={dataFim}
                  analise={analise}
                  consideraFdsFeriado={consideraFdsFeriado}
                />
              )}
              
              {/* Aviso de Estimativa */}
              <EstimativaAviso />
              
              {/* Centro de Custo + Engenheiro lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Centro de Custo *</Label>
                  <Combobox
                    options={centrosCusto.map((cc) => ({
                      value: cc.id,
                      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
                    }))}
                    value={centroCustoId}
                    onChange={setCentroCustoId}
                    placeholder="Selecione o centro de custo..."
                    searchPlaceholder="Buscar centro de custo..."
                    emptyText="Nenhum centro de custo encontrado"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Engenheiro Solicitante <span className="text-destructive">*</span>
                  </Label>
                  <Combobox
                    options={engenheirosEGerentes.map((f: any) => ({
                      value: f.id,
                      label: f.nome_completo
                    }))}
                    value={engenheiroSolicitanteId}
                    onChange={setEngenheiroSolicitanteId}
                    placeholder="Selecione o engenheiro..."
                    searchPlaceholder="Buscar engenheiro..."
                    emptyText="Nenhum engenheiro encontrado"
                    className={`mt-1.5 ${attemptedNext && !engenheiroSolicitanteId ? 'border-destructive ring-destructive' : ''}`}
                  />
                  {attemptedNext && !engenheiroSolicitanteId && (
                    <p className="text-xs text-destructive mt-1">Campo obrigatório</p>
                  )}
                </div>
              </div>

              {/* Aprovador info */}
              {selectedCentroCusto && (
                <div className="p-3 bg-muted rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">Aprovador:</span>
                    <span>
                      {aprovadorNome || <span className="text-destructive">Não definido</span>}
                    </span>
                  </div>
                  {selectedCentroCusto.aprovador_diarias_id ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className="h-3 w-3 text-primary" />
                      Este centro de custo tem aprovador definido
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Sem aprovador definido - qualquer administrador pode aprovar
                    </p>
                  )}
                </div>
              )}

              {/* Apontador + Responsável lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    Apontador (Resp. Campo) <span className="text-destructive">*</span>
                  </Label>
                  <Combobox
                    options={mergeFuncionarios(responsaveisCampo, funcionariosPreservados).map((f: any) => ({
                      value: f.id,
                      label: f.nome_completo
                    }))}
                    value={responsavelCampoId}
                    onChange={setResponsavelCampoId}
                    placeholder="Selecione o apontador..."
                    searchPlaceholder="Buscar apontador ou responsável..."
                    emptyText="Nenhum responsável encontrado"
                    className={`mt-1.5 ${attemptedNext && !responsavelCampoId ? 'border-destructive ring-destructive' : ''}`}
                  />
                  {attemptedNext && !responsavelCampoId ? (
                    <p className="text-xs text-destructive mt-1">Campo obrigatório</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Responsável por registrar presença em campo
                    </p>
                  )}
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Responsável pela Solicitação
                  </Label>
                  <div className="mt-1.5 p-3 bg-muted/50 border rounded-md flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {usuarioLogado?.nome_completo || user?.email || 'Carregando...'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Preenchido automaticamente
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Funcionários */}
          {step === 'funcionarios' && (
            <div className="flex flex-col gap-4">
              {/* Topo fixo: busca */}
              <SmartFuncionarioSearch
                funcionarios={funcionariosBusca}
                centrosCusto={centrosCusto}
                convocadosPre={convocadosPre}
                onSelectFuncionario={handleAddFuncionarioById}
                onSelectCentroCusto={handleAddByCentroCusto}
                alocacoesPorFuncionario={alocacoesPorFuncionario}
                onSelectFuncionarioComConflito={(conflito) => setConflitoPendente(conflito)}
                searchValue={funcSearch}
                onSearchChange={setFuncSearch}
                isSearching={isFetchingFuncionarios}
                elegibilidadeMap={elegibilidadeMap}
                totalFuncionariosPorCentroOverride={totalFuncionariosPorCentroOverride}
              />

              {/* Meio: lista com scroll isolado */}
              {convocadosPre.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Nenhum funcionário adicionado. Selecione ao menos um funcionário para prosseguir.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[280px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Diária</TableHead>
                        <TableHead className="text-right">FDS/Fer</TableHead>
                        <TableHead className="text-right">Refeição</TableHead>
                        <TableHead className="text-center">D/Férias</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {convocadosPre.map((conv) => {
                        const funcData = funcionarios.find((f: any) => f.id === conv.funcionario_id);
                        const temMatricula = !!funcData?.matricula;
                        const alocacao = alocacoesPorFuncionario.get(conv.funcionario_id);
                        // Remessa bloqueado: tem matrícula, período tem dias úteis, sem D/Férias, solicitação normal
                        const remessaBloqueado = false; // Removed visual blocking per user request
                        const detalheSimulacao = simulacao.detalhePorFuncionario.find(d => d.funcionario_id === conv.funcionario_id);
                        
                        return (
                        <TableRow key={conv.funcionario_id}>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span>{conv.nome_funcionario}</span>
                              <div className="flex gap-1 flex-wrap">
                                {temMatricula && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-700">
                                    Remessa
                                  </Badge>
                                )}
                                {remessaBloqueado && (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                    🚫 Não elegível p/ dias úteis
                                  </Badge>
                                )}
                                {alocacao && (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                    Convocado: {alocacao.codigo_centro_custo} — {alocacao.numero_solicitacao}
                                  </Badge>
                                )}
                                {!remessaBloqueado && temDiasUteis && temMatricula && conv.usar_diaria_exclusiva && (
                                  <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                                    <AlertTriangle className="h-3 w-3" /> D/Férias ativado
                                  </span>
                                )}
                                {diasOperacionaisSelecionados.length > 0 && (
                                  <span className="text-[10px] text-primary flex items-center gap-0.5">
                                    <Calendar className="h-3 w-3" /> Feriado/ponte operacional no período
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{conv.nome_funcao}</TableCell>
                          <TableCell className="text-right text-xs">
                            {formatCurrency(conv.valor_diaria)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria * 1.2)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatCurrency(conv.valor_refeicao || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={conv.usar_diaria_exclusiva || false}
                              onCheckedChange={(checked) => handleTipoDiariaChange(conv.funcionario_id, !!checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFuncionario(conv.funcionario_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {/* Baixo fixo: Simulação + Justificativa */}
              {convocadosPre.length > 0 && (
                <SimulacaoValores
                  simulacao={simulacao}
                  diasUteis={resumoSimulacaoPeriodo.diasUteis}
                  diasFds={resumoSimulacaoPeriodo.diasExclusivos}
                  diasParaRefeicao={resumoSimulacaoPeriodo.diasParaRefeicao}
                />
              )}

              <div className="pt-4 border-t">
                {isRetroativo && isSuperAdmin && !isEditing ? (
                  <div className="p-3 border border-amber-300 bg-amber-50 rounded-md">
                    <Label className="text-amber-900 text-xs font-semibold">Justificativa de criação retroativa</Label>
                    <p className="text-sm text-amber-900 mt-1 whitespace-pre-wrap">{justificativa}</p>
                    <p className="text-xs text-amber-700 mt-2">
                      Justificativa já preenchida no Step 1 — clique em Voltar para editar.
                    </p>
                  </div>
                ) : (
                  <>
                    <Label>
                      {isRetroativo && !isEditing
                        ? 'Justificativa para criação retroativa * (mínimo 20 caracteres)'
                        : `Justificativa * (mínimo ${minJustificativa} caracteres)`}
                    </Label>
                    <Textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder={isRetroativo && !isEditing
                        ? "Explique o motivo da criação retroativa desta solicitação..."
                        : "Descreva o motivo da solicitação de diária..."}
                      rows={3}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {justificativa.length}/{minJustificativa} caracteres mínimos
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Revisão */}
          {step === 'revisao' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Período</Label>
                      <p className="font-medium">
                        {formatBrazilianDateForDisplay(dataInicio)}
                        {dataFim !== dataInicio && (
                          <> → {formatBrazilianDateForDisplay(dataFim)}</>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Centro de Custo</Label>
                      <p className="font-medium">
                        {selectedCentroCusto?.codigo_centro_custo} - {selectedCentroCusto?.nome_centro_custo}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Seg-Sex</Label>
                      <p className="font-medium">{resumoSimulacaoPeriodo.diasUteis}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Sábados</Label>
                      <p className="font-medium">{resumoSimulacaoPeriodo.sabados}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Domingos</Label>
                      <p className="font-medium">{resumoSimulacaoPeriodo.domingos}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Feriados</Label>
                      <p className="font-medium">{resumoSimulacaoPeriodo.feriados + resumoSimulacaoPeriodo.diasOperacionais}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Considera FDS/Feriados</Label>
                      <Badge variant={consideraFdsFeriado ? 'default' : 'outline'}>
                        {consideraFdsFeriado ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Aprovador</Label>
                      <p className="font-medium">
                        {aprovadorNome || 'Não definido (qualquer admin)'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Responsável</Label>
                      <p className="font-medium">
                        {usuarioLogado?.nome_completo || user?.email || '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Apontador</Label>
                      <p className="font-medium">
                        {apontadorNome || 'Não definido'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Justificativa</Label>
                    <p className="text-sm">{justificativa}</p>
                  </div>

                  {diasOperacionaisResumo.length > 0 && (
                    <div className="space-y-3 border-t pt-3">
                      <div>
                        <Label className="text-muted-foreground">Dias operacionais do período</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {diasOperacionaisResumo.map((item) => (
                            <Badge key={item.data} variant="secondary" className="text-xs">
                              {formatBrazilianDateForDisplay(item.data)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Classificação</Label>
                          <p className="font-medium">Feriado / ponte operacional</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Observação</Label>
                          <p className="text-sm">{justificativaOperacional.trim()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <Label className="text-muted-foreground mb-2 block">
                    Funcionários Convocados ({convocadosPre.length})
                  </Label>
                  <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Diária</TableHead>
                        <TableHead className="text-right">FDS/Fer</TableHead>
                        <TableHead className="text-right">Refeição</TableHead>
                        <TableHead className="text-center">D/Férias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {convocadosPre.map((conv) => (
                        <TableRow key={conv.funcionario_id}>
                          <TableCell>{conv.nome_funcionario}</TableCell>
                          <TableCell>{conv.nome_funcao}</TableCell>
                          <TableCell className="text-right">{formatCurrency(conv.valor_diaria)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria * 1.2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(conv.valor_refeicao || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            {conv.usar_diaria_exclusiva && (
                              <Badge variant="default" className="text-xs">D/Férias</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Valor Total Estimado */}
              <SimulacaoValores
                simulacao={simulacao}
                diasUteis={resumoSimulacaoPeriodo.diasUteis}
                diasFds={resumoSimulacaoPeriodo.diasExclusivos}
                diasParaRefeicao={resumoSimulacaoPeriodo.diasParaRefeicao}
              />
              
              <EstimativaAviso />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step !== 'dados' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'revisao' ? 'funcionarios' : 'dados')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          
          {step === 'dados' && (
            <Button 
              onClick={async () => {
                setAttemptedNext(true);
                if (!canProceedToDados || justificativaOperacionalInvalida) return;
                console.info('[Diarias][Modal] avançando para funcionários', {
                  centroCustoId,
                  dataInicio,
                  dataFim,
                  diasOperacionaisSelecionados,
                });
                const persisted = await persistirRegrasOperacionaisSelecionadas();
                if (persisted) setStep('funcionarios');
              }}
              disabled={isSavingRegrasOperacionais}
            >
              {isSavingRegrasOperacionais && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          
          {step === 'funcionarios' && (
            <Button 
              onClick={() => {
                // Cálculo financeiro silencioso: remessa com dias úteis zerados automaticamente
                setStep('revisao');
              }}
              disabled={!canProceedToFuncionarios}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          
          {step === 'revisao' && (
            <>
              <Button 
                variant="outline"
                onClick={handleSave}
                disabled={!canSave || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Rascunho
              </Button>
              {onSaveAndSend && (
                <Button 
                  onClick={handleSaveAndSend}
                  disabled={!canSave || isSaving}
                >
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Send className="h-4 w-4 mr-2" />
                  Salvar e Enviar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmação de adição de funcionário com conflito operacional */}
    <ConfirmDialog
      isOpen={!!conflitoPendente}
      onClose={() => setConflitoPendente(null)}
      onConfirm={async () => {
        const c = conflitoPendente;
        if (!c) return;
        await handleAddFuncionarioById(c.funcionarioId, true);
        setConflitoPendente(null);
      }}
      title="Funcionário já vinculado a outra solicitação"
      description={
        conflitoPendente?.alocacao
          ? `Funcionário já vinculado à solicitação ${conflitoPendente.alocacao.numero_solicitacao} no centro de custo ${conflitoPendente.alocacao.codigo_centro_custo}. ` +
            `Você pode adicioná-lo à convocação aqui — caso ele apareça apontado em ambos no mesmo dia, o apontamento exigirá justificativa de exceção.`
          : (conflitoPendente?.motivo
              ? `${conflitoPendente.motivo}. Deseja prosseguir mesmo assim?`
              : "Este funcionário possui um conflito operacional. Deseja prosseguir mesmo assim?")
      }
      confirmText="Adicionar mesmo assim"
      cancelText="Cancelar"
      variant="warning"
    />

    {/* Confirmação para "Adicionar por CC" quando volume é grande (>= 100) */}
    <ConfirmDialog
      isOpen={!!pendingCcAdd}
      onClose={() => setPendingCcAdd(null)}
      onConfirm={confirmarAddByCc}
      title="Carregar funcionários do centro de custo"
      description={
        pendingCcAdd
          ? `Foram encontrados ${pendingCcAdd.preview} funcionários vinculados ao centro de custo ${centrosCusto.find((cc) => cc.id === pendingCcAdd.ccId)?.codigo_centro_custo || ''}. Deseja carregá-los?`
          : ''
      }
      confirmText="Carregar e adicionar"
      cancelText="Cancelar"
      variant="warning"
    />

    </>
  );
}
