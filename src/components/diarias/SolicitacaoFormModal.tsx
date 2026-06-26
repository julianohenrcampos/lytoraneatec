import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, startOfWeek, endOfWeek, parseISO, eachDayOfInterval, isWeekend } from "date-fns";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, Loader2, Users, FileText, Check, ChevronRight, ChevronLeft, Info, Lock, User, Send, ClipboardCheck, AlertTriangle, Calendar, Shield, Globe2 } from "lucide-react";
import { SmartFuncionarioSearch, type ConflitoSelecao } from "./SmartFuncionarioSearch";
import { MatrizFuncionarioData } from "./MatrizFuncionarioData";
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
  validarPeriodoExtraordinario,
  primeiraDataValidaNormal,
  calcularJanelaSemanal,
  formatCurrency,
  podeParticiparDiaUtil,
  isAnteriorAHoje
} from "@/utils/diariasPeriodoUtils";
import { PeriodoResumo } from "./PeriodoResumo";
import { EstimativaAviso } from "./EstimativaAviso";
import { SimulacaoValores } from "./SimulacaoValores";
import { calcularEstimativaPorMatriz } from "@/utils/diariasEstimativaMatriz";
import { avaliarCelula, type ResultadoElegibilidade } from "@/utils/diariasElegibilidadeMatriz";
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
  // Fase A — verde: dias solicitados normais (trabalho), sem exigência de justificativa.
  // diasOperacionaisSelecionados (laranja) = ponte/feriado operacional, exige justificativa.
  // União dos dois = dias solicitados para trabalho (entram na matriz Fase B).
  const [diasSolicitadosSelecionados, setDiasSolicitadosSelecionados] = useState<string[]>([]);
  const [justificativaOperacional, setJustificativaOperacional] = useState(JUSTIFICATIVA_OPERACIONAL_PADRAO);
  const [isSavingRegrasOperacionais, setIsSavingRegrasOperacionais] = useState(false);
  const [regrasOperacionaisDirty, setRegrasOperacionaisDirty] = useState(false);
  const ultimoContextoRegrasCarregadoRef = useRef<string | null>(null);

  // Fase B — Matriz funcionário × data (apenas em memória).
  // NÃO é serializada no payload `convocados_pre` neste build.
  const [diasPorFuncionario, setDiasPorFuncionario] = useState<Record<string, string[]>>({});
  const [diaAtivoMatriz, setDiaAtivoMatriz] = useState<string | null>(null);
  // Fase E — guarda se a matriz foi hidratada do JSON persistido (edição).
  const matrizHidratadaDaEdicaoRef = useRef(false);
  const contextoMatrizProntoRef = useRef(false);

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
    return validarPeriodoExtraordinario(dataInicio, dataFim, 30, isSuperAdmin, !!editingSolicitacao);
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

  // Fase C — conflito funcionário/data unificado.
  // Fonte 1 (efetivo): bd_diaria_presencas — solicitações já autorizadas/apontadas.
  // Fonte 2 (planejado): bd_diaria_solicitacoes.convocados_pre (jsonb) — solicitações
  // ainda em rascunho/aguardando, antes de gerarem presenças.
  // Confirmação técnica: NÃO existe tabela bd_diaria_convocados_pre. A fonte real
  // dos convocados planejados é a coluna jsonb bd_diaria_solicitacoes.convocados_pre.
  // Fonte 1 — presenças EFETIVAS (com hora_entrada). Único critério de
  // BLOQUEIO funcionário/data (paridade com fn_diaria_funcionario_elegibilidade).
  // Regra idêntica para Normal e Extraordinária.
  const { data: presencasConflito = [] } = useQuery({
    queryKey: ['presencas-conflito-efetivas', dataInicio, dataFim, editingSolicitacao?.id],
    queryFn: async () => {
      if (!dataInicio || !dataFim) return [] as any[];
      let q = supabase
        .from('bd_diaria_presencas')
        .select(`
          funcionario_id,
          data,
          solicitacao_id,
          hora_entrada,
          bd_diaria_solicitacoes!inner (
            numero_solicitacao,
            status,
            centro_custo_id,
            bd_centros_custo ( codigo_centro_custo )
          )
        `)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .not('hora_entrada', 'is', null)
        .neq('bd_diaria_solicitacoes.status', 'cancelado');

      if (editingSolicitacao?.id) {
        q = q.neq('solicitacao_id', editingSolicitacao.id);
      }

      const { data, error } = await q;
      if (error) {
        console.error('[Diarias] Erro ao buscar presenças efetivas de conflito:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!dataInicio && !!dataFim,
  });

  // Fase C — fonte planejada (status != cancelado, com período sobreposto ao do form).
  const { data: planejadoConflito = [] } = useQuery({
    queryKey: ['planejado-conflito', dataInicio, dataFim, editingSolicitacao?.id],
    queryFn: async () => {
      if (!dataInicio || !dataFim) return [] as any[];
      let q = supabase
        .from('bd_diaria_solicitacoes')
        .select(`
          id,
          numero_solicitacao,
          status,
          data_inicio,
          data_fim,
          convocados_pre,
          bd_centros_custo ( codigo_centro_custo )
        `)
        .lte('data_inicio', dataFim)
        .gte('data_fim', dataInicio)
        .neq('status', 'cancelado');

      if (editingSolicitacao?.id) {
        q = q.neq('id', editingSolicitacao.id);
      }

      const { data, error } = await q;
      if (error) {
        console.error('[Diarias] Erro ao buscar solicitações planejadas para conflito:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!dataInicio && !!dataFim,
  });

  // Map por funcionário com 2 níveis de severidade:
  //   - datas_bloqueio: presenças EFETIVAS (hora_entrada IS NOT NULL) na MESMA data
  //                     em outra solicitação ativa → bloqueio duro funcionário/data.
  //   - datas_alerta:   convocados_pre planejado em outra solicitação ativa →
  //                     apenas alerta, NUNCA bloqueia salvar.
  // `datas` é a união (compat com callers que ainda leem o campo agregado).
  // Regra idêntica para Normal e Extraordinária (diferença vive em
  // assertSolicitacaoNormalValida e na matriz Fase D, não aqui).
  type AlocacaoConflito = {
    numero_solicitacao: string;
    codigo_centro_custo: string;
    solicitacao_id: string;
    datas_bloqueio: string[];
    datas_alerta: string[];
    datas: string[];
  };

  const alocacoesPorFuncionario = useMemo(() => {
    const map = new Map<string, AlocacaoConflito>();

    const upsert = (
      funcId: string,
      entry: { numero_solicitacao: string; codigo_centro_custo: string; solicitacao_id: string; datas: string[] },
      severidade: 'bloqueio' | 'alerta',
    ) => {
      if (!funcId) return;
      const existing = map.get(funcId);
      const alvo: AlocacaoConflito = existing ?? {
        numero_solicitacao: entry.numero_solicitacao,
        codigo_centro_custo: entry.codigo_centro_custo,
        solicitacao_id: entry.solicitacao_id,
        datas_bloqueio: [],
        datas_alerta: [],
        datas: [],
      };
      const bucket = severidade === 'bloqueio' ? alvo.datas_bloqueio : alvo.datas_alerta;
      for (const d of entry.datas) {
        if (!bucket.includes(d)) bucket.push(d);
      }
      bucket.sort();
      // Recalcula união
      const uniao = new Set<string>([...alvo.datas_bloqueio, ...alvo.datas_alerta]);
      alvo.datas = Array.from(uniao).sort();
      // Bloqueio "ganha" para metadados visuais
      if (severidade === 'bloqueio') {
        alvo.numero_solicitacao = entry.numero_solicitacao || alvo.numero_solicitacao;
        alvo.codigo_centro_custo = entry.codigo_centro_custo || alvo.codigo_centro_custo;
        alvo.solicitacao_id = entry.solicitacao_id || alvo.solicitacao_id;
      }
      map.set(funcId, alvo);
    };

    // Helper local: enumera datas YYYY-MM-DD entre [ini, fim] inclusive (UTC, sem off-by-one).
    const enumerar = (ini: string, fim: string): string[] => {
      if (!ini || !fim || fim < ini) return [];
      const out: string[] = [];
      const d0 = new Date(`${ini}T00:00:00Z`);
      const d1 = new Date(`${fim}T00:00:00Z`);
      if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return [];
      const cursor = new Date(d0);
      while (cursor <= d1) {
        out.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out;
    };

    // Fonte 1 — efetivo com hora_entrada (BLOQUEIO).
    for (const p of presencasConflito as any[]) {
      const sol = p.bd_diaria_solicitacoes;
      if (!sol) continue;
      upsert(
        p.funcionario_id,
        {
          numero_solicitacao: sol.numero_solicitacao || '',
          codigo_centro_custo: sol.bd_centros_custo?.codigo_centro_custo || '',
          solicitacao_id: p.solicitacao_id,
          datas: [p.data],
        },
        'bloqueio',
      );
    }

    // Fonte 2 — planejado em convocados_pre de outra solicitação (ALERTA).
    if (dataInicio && dataFim) {
      for (const sol of planejadoConflito as any[]) {
        const ini = sol.data_inicio > dataInicio ? sol.data_inicio : dataInicio;
        const fim = sol.data_fim < dataFim ? sol.data_fim : dataFim;
        const datasIntersec = enumerar(ini, fim);
        if (datasIntersec.length === 0) continue;
        const arr = Array.isArray(sol.convocados_pre) ? sol.convocados_pre : [];
        const codigo = sol.bd_centros_custo?.codigo_centro_custo || '';
        for (const c of arr) {
          const fid = (c as any)?.funcionario_id;
          if (!fid) continue;
          upsert(
            fid,
            {
              numero_solicitacao: sol.numero_solicitacao || '',
              codigo_centro_custo: codigo,
              solicitacao_id: sol.id,
              datas: datasIntersec,
            },
            'alerta',
          );
        }
      }
    }

    return map;
  }, [presencasConflito, planejadoConflito, dataInicio, dataFim]);

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

  // Fase 2 — Dias laranja vindos do snapshot da própria solicitação (escopo LOCAL).
  // Não confundir com regras GLOBAIS do calendário operacional do CC.
  const snapshotLaranjaIniciais = useMemo(() => {
    const datas = (editingSolicitacao as any)?.regras_operacionais_snapshot?.datas;
    if (!datas || typeof datas !== 'object') return [] as string[];
    return Object.entries(datas)
      .filter(([, v]: [string, any]) => v?.ativa === true)
      .map(([k]) => k);
  }, [editingSolicitacao]);

  const carregarRegrasOperacionaisPeriodo = useCallback(async (force = false) => {
    if (!datasPeriodo.length || !centroCustoId) {
      setRegrasOperacionaisPorData({});
      // Fase A fix: NÃO limpar diasSolicitadosSelecionados/diasOperacionaisSelecionados aqui.
      // São estado puro de UI; o reset correto acontece no useEffect de open/close do modal.
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
    const diasGlobais = regrasEntries
      .filter(([, regra]) => regra?.encontrada && regra.tipoDiaOperacional === 'operacional')
      .map(([data]) => data);
    const descricaoAtiva = regrasEntries.find(([, regra]) => regra?.descricao?.trim())?.[1].descricao?.trim();

    setRegrasOperacionaisPorData(regrasMap);

    const novoContexto = ultimoContextoRegrasCarregadoRef.current !== contextoRegrasOperacionais;

    // Fase A fix: ao mudar de contexto (CC/período), limpar seleções fora do novo período.
    if (novoContexto) {
      const diasValidos = new Set(datasPeriodo.map((d) => d.value));
      setDiasSolicitadosSelecionados((prev) => prev.filter((d) => diasValidos.has(d)));
      setDiasOperacionaisSelecionados((prev) => prev.filter((d) => diasValidos.has(d)));
    }

    // Fase 2 — primeira carga do contexto: seed dos laranjas é união(snapshot LOCAL ∪ globais).
    // Snapshot LOCAL só vale para edição (vem da própria solicitação salva).
    if (novoContexto || !regrasOperacionaisDirty) {
      const diasValidos = new Set(datasPeriodo.map((d) => d.value));
      const seedLocal = editingSolicitacao
        ? snapshotLaranjaIniciais.filter((d) => diasValidos.has(d))
        : [];
      const uniao = Array.from(new Set<string>([...seedLocal, ...diasGlobais]));
      setDiasOperacionaisSelecionados(uniao);
      if (uniao.length > 0) {
        const laranjaSet = new Set(uniao);
        setDiasSolicitadosSelecionados((prev) => prev.filter((d) => !laranjaSet.has(d)));
      }
    }
    // Fase A — back-compat: ao editar uma solicitação existente, todos os dias do período
    // que não estão como laranja (snapshot OU global) viram "verdes" (solicitados normais).
    if (editingSolicitacao && (novoContexto || !regrasOperacionaisDirty)) {
      const diasValidos = new Set(datasPeriodo.map((d) => d.value));
      const seedLocal = snapshotLaranjaIniciais.filter((d) => diasValidos.has(d));
      const laranjaSet = new Set<string>([...seedLocal, ...diasGlobais]);
      const verdes = datasPeriodo
        .map((d) => d.value)
        .filter((v) => !laranjaSet.has(v));
      setDiasSolicitadosSelecionados(verdes);
    }
    // Justificativa: prioriza descrição do snapshot/global; senão, padrão.
    const descricaoSnapshot = (editingSolicitacao as any)?.regras_operacionais_snapshot?.observacao?.trim();
    const haLaranja = diasGlobais.length > 0 || (editingSolicitacao && snapshotLaranjaIniciais.length > 0);
    setJustificativaOperacional(
      haLaranja
        ? (descricaoSnapshot || descricaoAtiva || JUSTIFICATIVA_OPERACIONAL_PADRAO)
        : JUSTIFICATIVA_OPERACIONAL_PADRAO,
    );
    setRegrasOperacionaisDirty(false);
    ultimoContextoRegrasCarregadoRef.current = contextoRegrasOperacionais;
  }, [datasPeriodo, centroCustoId, contextoRegrasOperacionais, regrasOperacionaisDirty, editingSolicitacao, snapshotLaranjaIniciais]);

  // Fase A — União dos dias solicitados para trabalho (verde + laranja).
  // É a fonte verdadeira de "dias da solicitação" para a matriz e validações.
  const diasSolicitadosTotais = useMemo(() => {
    const set = new Set<string>([
      ...diasSolicitadosSelecionados,
      ...diasOperacionaisSelecionados,
    ]);
    return Array.from(set).sort();
  }, [diasSolicitadosSelecionados, diasOperacionaisSelecionados]);

  // Fase A — Ciclo de estados ao clicar no chip de um dia:
  //   cinza (não solicitado) → verde (solicitado normal) → laranja (ponte/feriado operacional) → cinza
  const alternarDiaPeriodo = useCallback((data: string) => {
    setRegrasOperacionaisDirty(true);
    const isVerde = diasSolicitadosSelecionados.includes(data);
    const isLaranja = diasOperacionaisSelecionados.includes(data);
    if (!isVerde && !isLaranja) {
      // cinza → verde: defensivo, garante que data não esteja em laranja
      setDiasOperacionaisSelecionados((prev) => prev.filter((d) => d !== data));
      setDiasSolicitadosSelecionados((prev) => (prev.includes(data) ? prev : [...prev, data]));
    } else if (isVerde) {
      // verde → laranja: remove de verde, adiciona em laranja
      setDiasSolicitadosSelecionados((prev) => prev.filter((d) => d !== data));
      setDiasOperacionaisSelecionados((prev) => (prev.includes(data) ? prev : [...prev, data]));
    } else {
      // laranja → cinza: remove de ambos por segurança
      setDiasOperacionaisSelecionados((prev) => prev.filter((d) => d !== data));
      setDiasSolicitadosSelecionados((prev) => prev.filter((d) => d !== data));
    }
  }, [diasSolicitadosSelecionados, diasOperacionaisSelecionados]);

  // Fase 3 (futuro) — Reservado para a ação RBAC "Aplicar ao calendário operacional do centro".
  // NÃO chamar a partir do fluxo padrão de criação/edição: o modal de solicitação não pode mais
  // gravar automaticamente em bd_diaria_calendario_operacional.
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
          // consumidos pelo form (ex.: `usar_diaria_exclusiva`, `dias_solicitados`).
          const { extras, ...rest } = c;
          return { ...(extras ?? {}), ...rest };
        });
        setConvocadosPre(convocadosNormalizados as any);
        // Fase E — reidrata diasPorFuncionario a partir do jsonb persistido.
        // Se nenhum convocado tiver `dias_solicitados`, deixa vazio para que o
        // efeito de sincronização (linhas ~1449) caia no fallback legado e
        // popule cada funcionário com seus dias elegíveis padrão.
        const hidratado: Record<string, string[]> = {};
        let temDiasPersistidos = false;
        for (const c of convocadosNormalizados as any[]) {
          if (Array.isArray(c.dias_solicitados) && c.dias_solicitados.length > 0) {
            hidratado[c.funcionario_id] = [...c.dias_solicitados];
            temDiasPersistidos = true;
            console.debug('[DIARIA][REIDRATACAO_DIAS_SOLICITADOS]', {
              funcionario_id: c.funcionario_id,
              dias_solicitados_do_json: c.dias_solicitados,
              dias_aplicados_na_matriz: hidratado[c.funcionario_id],
            });
          }
        }
        matrizHidratadaDaEdicaoRef.current = temDiasPersistidos;
        contextoMatrizProntoRef.current = false;
        setDiasPorFuncionario(temDiasPersistidos ? hidratado : {});
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
        setDiasPorFuncionario({});
        matrizHidratadaDaEdicaoRef.current = false;
        contextoMatrizProntoRef.current = false;
      }
      setStep('dados');
      setAttemptedNext(false);
      setDuplicidadeDetectada(null);
      setRegrasOperacionaisPorData({});
      setDiasOperacionaisSelecionados([]);
      setDiasSolicitadosSelecionados([]);
      setDiaAtivoMatriz(null);
      setJustificativaOperacional(JUSTIFICATIVA_OPERACIONAL_PADRAO);
      setRegrasOperacionaisDirty(false);
      ultimoContextoRegrasCarregadoRef.current = null;
    }
  }, [isOpen, editingSolicitacao]);

  useEffect(() => {
    void carregarRegrasOperacionaisPeriodo();
  }, [carregarRegrasOperacionaisPeriodo]);

  // Verificar duplicidade por sobreposição de datas + centro de custo
  // Regra: apenas solicitações NORMAL têm limite de 1 por CC/semana.
  // Extraordinária pode coexistir com Normal e com outras Extraordinárias.
  useEffect(() => {
    if (!centroCustoId || !dataInicio || !dataFim || isEditing) {
      setDuplicidadeDetectada(null);
      return;
    }
    if (tipoSolicitacao === 'extraordinaria') {
      setDuplicidadeDetectada(null);
      return;
    }
    const checkDuplicate = async () => {
      const { data } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('id, numero_solicitacao')
        .eq('centro_custo_id', centroCustoId)
        .eq('tipo_solicitacao', 'normal')
        .lte('data_inicio', dataFim)
        .gte('data_fim', dataInicio)
        .not('status', 'in', '(cancelado,reprovada)')
        .limit(1);
      if (data && data.length > 0) {
        setDuplicidadeDetectada({ numero_solicitacao: data[0].numero_solicitacao, id: data[0].id });
      } else {
        setDuplicidadeDetectada(null);
      }
    };
    checkDuplicate();
  }, [centroCustoId, dataInicio, dataFim, isEditing, tipoSolicitacao]);

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

    // Bloqueio funcionário/data — apenas presença EFETIVA (hora_entrada IS NOT NULL)
    // em outra solicitação ativa na mesma data. Convocação planejada vira só alerta.
    // Em Extraordinária, mesmo `datas_bloqueio` NÃO impede a inclusão na lista —
    // vira alerta; o bloqueio real fica por célula (matriz) e por interseção no salvar.
    const conflitoAloc = alocacoesPorFuncionario.get(funcId);
    const isExtra = tipoSolicitacao === 'extraordinaria';
    if (conflitoAloc && conflitoAloc.datas_bloqueio.length > 0 && !forceAdd) {
      if (isExtra) {
        const datasFmt = conflitoAloc.datas_bloqueio.map((d) => d.split('-').reverse().slice(0, 2).join('/')).join(', ');
        toast.warning(
          `${func.nome_completo} tem apontamento real em ${conflitoAloc.numero_solicitacao} (CC ${conflitoAloc.codigo_centro_custo}) nas datas ${datasFmt}. Adicionado como alerta — essas células ficam bloqueadas na matriz.`,
          { duration: 7000 },
        );
        // segue o fluxo (sem return)
      } else {
        setConflitoPendente({
          funcionarioId: funcId,
          alocacao: {
            numero_solicitacao: conflitoAloc.numero_solicitacao,
            codigo_centro_custo: conflitoAloc.codigo_centro_custo,
          },
          motivo: `Datas com apontamento real em outra solicitação: ${conflitoAloc.datas_bloqueio.map((d) => d.split('-').reverse().join('/')).join(', ')}`,
        });
        return;
      }
    }
    if (conflitoAloc && conflitoAloc.datas_alerta.length > 0 && conflitoAloc.datas_bloqueio.length === 0) {
      toast.info(
        `${func.nome_completo} está planejado em ${conflitoAloc.numero_solicitacao} (CC ${conflitoAloc.codigo_centro_custo}) — sem apontamento real, inclusão liberada.`,
      );
    }

    // Regra dura: bloqueado pela RPC de elegibilidade.
    // Em Normal: NUNCA passa, ignora forceAdd.
    // Em Extraordinária: vira alerta (geralmente vínculo semanal em outra solicitação).
    const eleg = elegibilidadeMap.get(funcId);
    if (eleg?.status === 'bloqueado') {
      if (isExtra) {
        toast.warning(
          eleg.motivo
            ? `${func.nome_completo}: ${eleg.motivo}. Adicionado como alerta na extraordinária.`
            : `${func.nome_completo} sinalizado pela elegibilidade — adicionado como alerta na extraordinária.`,
          { duration: 6000 },
        );
        // segue o fluxo (sem return)
      } else {
        toast.error(eleg.motivo || `${func.nome_completo} está bloqueado para o período.`);
        return;
      }
    }

    // Legacy/compat: elegivel=false sem confirmação ainda exige forceAdd em Normal.
    // Em Extraordinária, alerta nunca bloqueia.
    if (!forceAdd && !isExtra && (func.elegivel === false || eleg?.status === 'alerta')) {
      toast.warning(eleg?.alertaMensagem || eleg?.motivo || func.motivo_bloqueio || `${func.nome_completo} requer confirmação.`);
      return;
    }

    const statusFunc: string | null = (func as any).status_funcionario ?? (func as any).status ?? null;
    const novoConvocado: FuncionarioPreConvocado = {
      funcionario_id: func.id,
      funcao_id: func.funcao_id,
      valor_diaria: func.bd_funcoes.valor_diaria || 0,
      valor_diaria_exclusiva: func.bd_funcoes.valor_diaria_exclusiva || undefined,
      valor_refeicao: func.bd_funcoes.valor_refeicao || 0,
      nome_funcionario: func.nome_completo,
      nome_funcao: func.bd_funcoes.nome_funcao,
      cpf: func.cpf || '',
      matricula: func.matricula || '',
      status: statusFunc,
      usar_diaria_exclusiva: statusFunc === 'Férias' || tipoSolicitacao === 'extraordinaria',
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
    let bloqueadosConflito = 0;
    const totalEncontrados = lista.length;

    for (const func of lista) {
      if (ccAlvoId && func.centro_custo_id !== ccAlvoId) { foraCc++; continue; }
      if (addedIds.has(func.id)) { jaExistentes++; continue; }
      if (!func.bd_funcoes) { semFuncao++; continue; }
      // Bloqueio funcionário/data em lote: apenas presença EFETIVA em outra
      // solicitação (datas_bloqueio). Alerta planejado (datas_alerta) NÃO bloqueia
      // — funcionário entra na lista normalmente.
      const alocLote = alocacoesPorFuncionario.get(func.id);
      if (alocLote && alocLote.datas_bloqueio.length > 0) { bloqueadosConflito++; continue; }

      const statusFunc: string | null = (func as any).status_funcionario ?? (func as any).status ?? null;
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
        status: statusFunc,
        usar_diaria_exclusiva: statusFunc === 'Férias' || tipoSolicitacao === 'extraordinaria',
      });
    }

    if (novos.length > 0) setConvocadosPre([...convocadosPre, ...novos]);

    const elegiveis = totalEncontrados - foraCc - semFuncao - bloqueadosConflito;
    const resumo = [
      `Encontrados no CC: ${totalEncontrados - foraCc}`,
      `Elegíveis: ${elegiveis}`,
      `Adicionados: ${novos.length}`,
      `Já na lista: ${jaExistentes}`,
      `Sem função: ${semFuncao}`,
    ];
    if (bloqueadosConflito > 0) resumo.push(`Bloqueados por conflito: ${bloqueadosConflito}`);
    if (foraCc > 0) resumo.push(`Fora do CC: ${foraCc}`);

    const mensagem = resumo.join(' • ');

    if (novos.length > 0) toast.success(mensagem);
    else if (jaExistentes > 0 || bloqueadosConflito > 0) toast.info(mensagem);
    else toast.warning(mensagem);
  }, [convocadosPre, alocacoesPorFuncionario]);

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

  // Sincroniza usar_diaria_exclusiva em massa quando alterna tipo Normal ↔ Extraordinária.
  // Extraordinária força exclusiva em todos. Voltar para Normal só desmarca quem NÃO
  // está em Férias (Férias mantém exclusiva sempre).
  useEffect(() => {
    setConvocadosPre(prev => {
      let mudou = false;
      const next = prev.map(c => {
        const alvo = c.status === 'Férias' || tipoSolicitacao === 'extraordinaria';
        if ((c.usar_diaria_exclusiva ?? false) === alvo) return c;
        mudou = true;
        return { ...c, usar_diaria_exclusiva: alvo };
      });
      return mudou ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoSolicitacao]);


  // Base histórica de presenças em FDS para refinar a estimativa de refeições
  // de fim de semana (objetivo 3). Usa apenas o ÚLTIMO sábado/domingo
  // anteriores ao período da solicitação, restrito ao CC.
  const { data: mediaFds } = useMediaPresencaFds(centroCustoId, {
    enabled: isOpen && step === 'funcionarios' && !!centroCustoId,
    periodoInicio: dataInicio || null,
  });

  // Fase C — Estimativa calculada exclusivamente pelos pares funcionário × data
  // marcados na matriz Fase B (`diasPorFuncionario`). Não usa média de FDS,
  // não agrega por período inteiro e não conta valor para par desmarcado.
  const simulacao = useMemo(() => {
    // Mescla regras operacionais locais (snapshot da solicitação) + globais (calendário do CC).
    const regrasMerged: Record<string, { ativa: boolean }> = {};
    for (const data of diasOperacionaisSelecionados) {
      regrasMerged[data] = { ativa: true };
    }
    for (const [data, regra] of Object.entries(regrasOperacionaisPorData)) {
      if (regra?.encontrada && regra.tipoDiaOperacional === 'operacional') {
        regrasMerged[data] = { ativa: true };
      }
    }
    return calcularEstimativaPorMatriz({
      convocadosPre: convocadosPre as any,
      diasPorFuncionario,
      datasClassificadas: analise.datasClassificadas,
      regrasOperacionaisPorData: regrasMerged,
      tipoSolicitacao,
    });
  }, [convocadosPre, diasPorFuncionario, analise.datasClassificadas, regrasOperacionaisPorData, diasOperacionaisSelecionados, tipoSolicitacao]);

  // Validation
  const isExtraordinariaValida = tipoSolicitacao === 'normal' || (tipoSolicitacao === 'extraordinaria' && justificativaExtraordinaria.trim().length >= 20);
  const justificativaRetroativaOk = !isRetroativo || isEditing || justificativa.trim().length >= 20;
  // Fase A — exige ≥1 dia solicitado (verde ou laranja).
  const canProceedToDados = !!dataInicio && !!dataFim && !!centroCustoId && periodoValidacao.valido && !!responsavelCampoId && !!engenheiroSolicitanteId && !duplicidadeDetectada && isExtraordinariaValida && justificativaRetroativaOk && diasSolicitadosTotais.length > 0;

  // Fase D — Mapa rápido de classificação por data e regras operacionais mescladas.
  const tipoDiaPorData = useMemo(() => {
    const map: Record<string, 'util' | 'sabado' | 'fds' | 'feriado'> = {};
    for (const dc of analise.datasClassificadas) map[dc.data] = dc.tipo;
    return map;
  }, [analise.datasClassificadas]);

  const operacionalPorData = useMemo(() => {
    const set = new Set<string>(diasOperacionaisSelecionados);
    for (const [data, regra] of Object.entries(regrasOperacionaisPorData)) {
      if (regra?.encontrada && regra.tipoDiaOperacional === 'operacional') set.add(data);
    }
    return set;
  }, [diasOperacionaisSelecionados, regrasOperacionaisPorData]);

  // Conflitos por (funcId, data) a partir de datas_bloqueio (presença real com
  // hora_entrada IS NOT NULL). datas_alerta é apenas visual e NÃO bloqueia a
  // célula — convocação planejada em outra solicitação ou presença sem
  // hora_entrada continuam permitindo seleção (regra igual para normal e
  // extraordinária).
  const conflitosPorFuncData = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [funcId, info] of alocacoesPorFuncionario.entries()) {
      map.set(funcId, new Set(info.datas_bloqueio));
    }
    return map;
  }, [alocacoesPorFuncionario]);

  // Resolve dados de funcionário (matricula/status) preferindo cache global,
  // caindo para snapshot do convocado quando o cache não tem o id.
  const resolveFuncDados = useCallback((funcId: string): { matricula: string | null; status: string | null } => {
    const f = funcionariosBusca.find((x: any) => x.id === funcId) || (funcionarios as any[]).find((x: any) => x.id === funcId);
    if (f) {
      return {
        matricula: (f.matricula ?? null) as string | null,
        status: (f.status_funcionario ?? f.status ?? null) as string | null,
      };
    }
    const conv = convocadosPre.find((c) => c.funcionario_id === funcId);
    return {
      matricula: conv?.matricula ?? null,
      status: (conv as any)?.status ?? null,
    };
  }, [funcionariosBusca, funcionarios, convocadosPre]);

  // Avalia uma célula da matriz (funcionário × data) com regra centralizada.
  const avaliarCelulaMatriz = useCallback((funcId: string, data: string): ResultadoElegibilidade => {
    const dados = resolveFuncDados(funcId);
    const tipoDia = tipoDiaPorData[data] ?? 'util';
    const isOperacional = operacionalPorData.has(data);
    const conflitoSet = conflitosPorFuncData.get(funcId);
    const temConflito = !!conflitoSet?.has(data);
    const eleg = elegibilidadeMap.get(funcId);
    const bloqueadoElegibilidadeRPC = eleg?.status === 'bloqueado';
    return avaliarCelula({
      temMatricula: !!dados.matricula,
      status: dados.status,
      tipoDia,
      isOperacional,
      temConflito,
      bloqueadoElegibilidadeRPC,
      tipoSolicitacao,
    });
  }, [resolveFuncDados, tipoDiaPorData, operacionalPorData, conflitosPorFuncData, elegibilidadeMap, tipoSolicitacao]);

  // Map por funcId → Map por data → ResultadoElegibilidade. Repassado à matriz.
  const elegibilidadeCelulaMap = useMemo(() => {
    const out = new Map<string, Map<string, ResultadoElegibilidade>>();
    for (const c of convocadosPre) {
      const inner = new Map<string, ResultadoElegibilidade>();
      for (const data of diasSolicitadosTotais) {
        inner.set(data, avaliarCelulaMatriz(c.funcionario_id, data));
      }
      out.set(c.funcionario_id, inner);
    }
    return out;
  }, [convocadosPre, diasSolicitadosTotais, avaliarCelulaMatriz]);

  // Dias que devem nascer marcados ao adicionar/sincronizar funcionário.
  const getDiasElegiveisDefault = useCallback((funcId: string): string[] => {
    return diasSolicitadosTotais.filter((d) => avaliarCelulaMatriz(funcId, d).marcarPorPadrao);
  }, [diasSolicitadosTotais, avaliarCelulaMatriz]);


  // Regras (Fase D):
  //  - novo funcionário ganha por padrão somente os dias ELEGÍVEIS;
  //  - funcionário removido sai da matriz;
  //  - dia removido do período some da lista de cada funcionário;
  //  - dia novo NÃO é auto-adicionado a funcionários existentes (usuário decide);
  //  - dias presentes na lista mas que se tornaram inelegíveis (conflito, etc.) são removidos.
  useEffect(() => {
    // Contexto pronto = totais carregados E todas as datas resolvidas em regras operacionais.
    // Enquanto não pronto, NÃO mexe em diasPorFuncionario (preserva hidratação da Fase E).
    const contextoPronto =
      diasSolicitadosTotais.length > 0 &&
      diasSolicitadosTotais.every((d) => regrasOperacionaisPorData[d] !== undefined);

    if (!contextoPronto) {
      setDiaAtivoMatriz((prev) => (prev ?? (diasSolicitadosTotais[0] || null)));
      return;
    }
    contextoMatrizProntoRef.current = true;

    setDiasPorFuncionario((prev) => {
      const next: Record<string, string[]> = {};
      const diasSet = new Set(diasSolicitadosTotais);
      for (const c of convocadosPre) {
        if (c.funcionario_id in prev) {
          // Já inicializado (manualmente, hidratado da Fase E ou recém-criado):
          // apenas sanitiza, NÃO repopula com defaults — preserva ação do usuário.
          const antes = prev[c.funcionario_id] ?? [];
          const depois = antes.filter((d) => {
            if (!diasSet.has(d)) return false;
            const av = avaliarCelulaMatriz(c.funcionario_id, d);
            return av.podeMarcar;
          });
          if (antes.length !== depois.length) {
            console.debug('[DIARIA][SYNC_DIAS_POR_FUNCIONARIO]', {
              funcionario_id: c.funcionario_id,
              antes,
              depois,
              removidos: antes.filter((d) => !depois.includes(d)),
              motivo_remocao: 'fora_do_periodo_ou_inelegivel',
            });
          }
          next[c.funcionario_id] = depois;
        } else {
          // Funcionário entrando agora na matriz: aplica default elegível.
          next[c.funcionario_id] = getDiasElegiveisDefault(c.funcionario_id);
        }
      }
      return next;
    });
    setDiaAtivoMatriz((prev) => (prev && diasSolicitadosTotais.includes(prev) ? prev : (diasSolicitadosTotais[0] || null)));
  }, [convocadosPre, diasSolicitadosTotais, avaliarCelulaMatriz, getDiasElegiveisDefault, regrasOperacionaisPorData]);

  // Fase B — dias do período sem nenhum funcionário convocado.
  const diasSemEquipe = useMemo(() => {
    if (diasSolicitadosTotais.length === 0) return [];
    const cobertos = new Set<string>();
    for (const lista of Object.values(diasPorFuncionario)) {
      for (const d of lista) cobertos.add(d);
    }
    return diasSolicitadosTotais.filter((d) => !cobertos.has(d));
  }, [diasPorFuncionario, diasSolicitadosTotais]);

  const canProceedToFuncionarios = convocadosPre.length > 0
    && justificativa.trim().length >= minJustificativa
    && diasSemEquipe.length === 0;

  const toggleFuncionarioNoDia = useCallback((funcId: string, data: string) => {
    // Defesa em profundidade: ignora toggle em célula inelegível.
    const av = avaliarCelulaMatriz(funcId, data);
    if (!av.podeMarcar) return;
    setDiasPorFuncionario((prev) => {
      const atual = prev[funcId] ?? [];
      const jaMarcado = atual.includes(data);
      // Bloqueia desmarcar o último dia: funcionário não pode ficar sem dias.
      if (jaMarcado && atual.length === 1) {
        toast.error(
          "Funcionário precisa ter pelo menos um dia marcado. Para remover da solicitação, use a lixeira."
        );
        return prev;
      }
      const novo = jaMarcado ? atual.filter((d) => d !== data) : [...atual, data].sort();
      return { ...prev, [funcId]: novo };
    });
  }, [avaliarCelulaMatriz]);

  // Dados ricos por funcionário para o card matriz (hovercard + filtro + badges).
  const dadosRicosPorFuncionario = useMemo(() => {
    const out: Record<string, import("./MatrizFuncionarioData").DadosRicosFunc> = {};
    for (const c of convocadosPre) {
      const dados = resolveFuncDados(c.funcionario_id);
      const alocacao = alocacoesPorFuncionario.get(c.funcionario_id) ?? null;
      const eleg = elegibilidadeMap.get(c.funcionario_id);
      out[c.funcionario_id] = {
        funcao: c.nome_funcao,
        valor_diaria: c.valor_diaria,
        valor_diaria_exclusiva: c.valor_diaria_exclusiva || c.valor_diaria * 1.2,
        valor_refeicao: c.valor_refeicao || 0,
        matricula: dados.matricula,
        status: dados.status,
        alocacao: alocacao
          ? {
              codigo_centro_custo: (alocacao as any).codigo_centro_custo ?? "",
              numero_solicitacao: (alocacao as any).numero_solicitacao ?? "",
              severidade: (alocacao as any).datas_bloqueio?.length > 0 ? 'bloqueio' : 'alerta',
              datas_bloqueio: (alocacao as any).datas_bloqueio ?? [],
              datas_alerta: (alocacao as any).datas_alerta ?? [],
            }
          : null,
        bloqueadoRPC: eleg?.status === "bloqueado",
      };
    }
    return out;
  }, [convocadosPre, resolveFuncDados, alocacoesPorFuncionario, elegibilidadeMap]);


  // Fase D — Conflitos funcionário/data ainda presentes na lista atual.
  // Pré-computado para alimentar canSave (botão desabilitado) E o submit final.
  // Conflitos REAIS ainda presentes: somente quando o funcionário tem
  // datas_bloqueio (presença efetiva em outra solicitação) E essas datas
  // estão marcadas para ele na matriz da solicitação atual.
  // Convocação planejada (datas_alerta) nunca bloqueia o salvar.
  // Regra idêntica para Normal e Extraordinária.
  const convocadosComConflito = useMemo(() => {
    const out: Array<{
      nome: string;
      numero_solicitacao: string;
      codigo_centro_custo: string;
      datas: string[];
    }> = [];
    for (const c of convocadosPre) {
      const aloc = alocacoesPorFuncionario.get(c.funcionario_id);
      if (!aloc || aloc.datas_bloqueio.length === 0) continue;
      const marcados = new Set(diasPorFuncionario[c.funcionario_id] || []);
      const datasReais = aloc.datas_bloqueio.filter((d) => marcados.has(d));
      if (datasReais.length === 0) continue;
      out.push({
        nome: c.nome_funcionario,
        numero_solicitacao: aloc.numero_solicitacao,
        codigo_centro_custo: aloc.codigo_centro_custo,
        datas: datasReais,
      });
    }
    return out;
  }, [convocadosPre, alocacoesPorFuncionario, diasPorFuncionario]);

  const temConflitoNaoResolvido = convocadosComConflito.length > 0;
  const canSave = canProceedToDados && canProceedToFuncionarios && !temConflitoNaoResolvido;
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
    convocados_pre: convocadosPre.map(c => {
      // Fase E — `dias_solicitados` reflete EXCLUSIVAMENTE as células marcadas
      // na matriz Fase B/D, filtrando defensivamente:
      //  (1) somente datas dentro do período/dias solicitados da solicitação;
      //  (2) somente células elegíveis (defesa contra estado obsoleto);
      //  (3) ordenadas asc e deduplicadas.
      const setSolicitados = new Set(diasSolicitadosTotais);
      const brutos = diasPorFuncionario[c.funcionario_id] || [];
      const dias_solicitados = Array.from(new Set(
        brutos.filter((d) => {
          if (!setSolicitados.has(d)) return false;
          const av = elegibilidadeCelulaMap.get(c.funcionario_id)?.get(d);
          return av ? av.podeMarcar : true;
        })
      )).sort();
      return {
        funcionario_id: c.funcionario_id,
        funcao_id: c.funcao_id,
        valor_diaria: c.valor_diaria,
        valor_diaria_exclusiva: c.valor_diaria_exclusiva,
        valor_refeicao: c.valor_refeicao,
        nome_funcionario: c.nome_funcionario,
        nome_funcao: c.nome_funcao,
        usar_diaria_exclusiva: c.usar_diaria_exclusiva || tipoSolicitacao === 'extraordinaria' || false,
        cpf: c.cpf,
        matricula: c.matricula,
        dias_solicitados,
      };
    }),
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

  // Fase D — Validação dura compartilhada antes de qualquer submit.
  // Bloqueia: (1) dias considerados = 0 → equivale a período sem datas;
  // (2) lista de convocados vazia; (3) qualquer conflito funcionário/data
  // não resolvido. Funcionários bloqueados por elegibilidade já são impedidos
  // de entrar em handleAddFuncionarioById, então não chegam aqui.
  const validarSubmitOuToast = (): boolean => {
    if (!dataInicio || !dataFim) {
      toast.error('Selecione um período válido para a solicitação.');
      return false;
    }
    if (convocadosPre.length === 0) {
      toast.error('Adicione ao menos um funcionário válido antes de salvar.');
      return false;
    }
    if (convocadosComConflito.length > 0) {
      const top = convocadosComConflito.slice(0, 3).map((c) => {
        const datas = c.datas.map((d) => d.split('-').reverse().join('/')).join(', ');
        return `${c.nome} já está em ${c.numero_solicitacao} (CC ${c.codigo_centro_custo}) nas datas ${datas}`;
      }).join(' • ');
      const restante = convocadosComConflito.length - 3;
      toast.error(
        restante > 0
          ? `${convocadosComConflito.length} conflito(s) funcionário/data não resolvidos. ${top} • +${restante} outro(s).`
          : `Conflito funcionário/data não resolvido: ${top}`,
        { duration: 8000 },
      );
      return false;
    }

    // Fase E3 — bloqueios de coerência matriz × convocados.
    const setSolicitados = new Set(diasSolicitadosTotais);
    // (a) funcionário sem nenhum dia marcado.
    for (const c of convocadosPre) {
      const dias = (diasPorFuncionario[c.funcionario_id] || []).filter((d) => setSolicitados.has(d));
      if (dias.length === 0) {
        toast.error(`Funcionário "${c.nome_funcionario}" não está marcado em nenhum dia da matriz.`);
        return false;
      }
    }
    // (b) dia solicitado sem nenhum funcionário marcado.
    for (const d of diasSolicitadosTotais) {
      const algum = convocadosPre.some((c) => (diasPorFuncionario[c.funcionario_id] || []).includes(d));
      if (!algum) {
        toast.error(`Dia ${d.split('-').reverse().join('/')} não tem nenhum funcionário marcado na matriz.`);
        return false;
      }
    }
    // (c) saneamento defensivo: bloqueia se algum dia marcado for inelegível.
    for (const c of convocadosPre) {
      const dias = diasPorFuncionario[c.funcionario_id] || [];
      for (const d of dias) {
        const av = elegibilidadeCelulaMap.get(c.funcionario_id)?.get(d);
        if (av && !av.podeMarcar) {
          toast.error(`"${c.nome_funcionario}" tem o dia ${d.split('-').reverse().join('/')} marcado mas inelegível. Desmarque antes de salvar.`);
          return false;
        }
      }
    }
    return true;
  };

  // Fase E5 — log temporário de auditoria da matriz persistida em convocados_pre.
  const logPersistenciaConvocadosPre = (payload: SolicitacaoFormData) => {
    const lista = (payload.convocados_pre || []) as Array<any>;
    const totalDias = lista.reduce(
      (acc, c) => acc + (Array.isArray(c.dias_solicitados) ? c.dias_solicitados.length : 0),
      0,
    );
    const fallbackLegado = lista.length > 0 && lista.every(
      (c) => !Array.isArray(c.dias_solicitados) || c.dias_solicitados.length === 0,
    );
    console.info('[DIARIA][CONVOCADOS_PRE_PERSISTENCIA]', {
      total_convocados: lista.length,
      total_dias_solicitados: totalDias,
      fallback_legado: fallbackLegado,
      amostra: lista.slice(0, 3).map((c) => ({
        funcionario_id: c.funcionario_id,
        nome_funcionario: c.nome_funcionario,
        dias_solicitados: c.dias_solicitados ?? null,
      })),
    });
  };

  // Handle save as draft
  const handleSave = async () => {
    if (!validarSubmitOuToast()) return;
    const payload = buildFormData();

    console.info('[Diarias][Modal] salvar rascunho', {
      userId: user?.id || null,
      canCreateSolicitacao,
      permissions,
      payload,
    });
    logPersistenciaConvocadosPre(payload);

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  // Handle save and send for authorization
  const handleSaveAndSend = async () => {
    if (!validarSubmitOuToast()) return;
    const payload = buildFormData();

    console.info('[Diarias][Modal] salvar e enviar', {
      userId: user?.id || null,
      canCreateSolicitacao,
      permissions,
      payload,
    });
    logPersistenciaConvocadosPre(payload);

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
              {/* Tipo de Solicitação — compacto, alinhado à direita */}
              <div className="flex items-center justify-end gap-3">
                <Label className="text-sm text-muted-foreground">Tipo de Solicitação</Label>
                <RadioGroup
                  value={tipoSolicitacao}
                  onValueChange={(v) => setTipoSolicitacao(v as 'normal' | 'extraordinaria')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="tipo-normal" />
                    <Label htmlFor="tipo-normal" className="cursor-pointer text-sm">Normal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="extraordinaria" id="tipo-extra" />
                    <Label htmlFor="tipo-extra" className="cursor-pointer text-sm text-amber-700">Extraordinária</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Centro de Custo + Engenheiro */}
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

              {/* Apontador + Responsável pela Solicitação */}
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
                  <div className="mt-1.5 p-2.5 bg-muted/50 border rounded-md flex items-center gap-2">
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

              {/* Data Início + Data Fim */}
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

                      // Extraordinária: sem força de semana operacional.
                      // Sugere dataFim = dataInicio; usuário pode editar livremente.
                      if ((tipoSolicitacao || 'normal') === 'extraordinaria') {
                        setDataInicio(format(escolhida, 'yyyy-MM-dd'));
                        setDataFim(format(escolhida, 'yyyy-MM-dd'));
                        return;
                      }

                      const domingo = endOfWeek(escolhida, { weekStartsOn: 1 });

                      if (isSuperAdmin) {
                        setDataInicio(format(escolhida, 'yyyy-MM-dd'));
                        setDataFim(format(domingo, 'yyyy-MM-dd'));
                        return;
                      }

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
                  <Label className="text-xs text-muted-foreground">
                    {(tipoSolicitacao || 'normal') === 'extraordinaria' ? 'Data Fim' : 'Data Fim (Domingo)'}
                  </Label>
                  <Input
                    type="date"
                    value={dataFim}
                    min={dataInicio || undefined}
                    onChange={(e) => {
                      if ((tipoSolicitacao || 'normal') === 'extraordinaria') {
                        setDataFim(e.target.value);
                      }
                    }}
                    readOnly={(tipoSolicitacao || 'normal') !== 'extraordinaria'}
                    disabled={isEditing || (tipoSolicitacao || 'normal') !== 'extraordinaria'}
                    tabIndex={(tipoSolicitacao || 'normal') === 'extraordinaria' ? 0 : -1}
                    className={(tipoSolicitacao || 'normal') === 'extraordinaria' ? '' : 'cursor-not-allowed bg-muted'}
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

              {/* Justificativa retroativa (SuperAdm) */}
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

              {/* Dias solicitados para trabalho */}
              {dataInicio && dataFim && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div>
                    <Label>Dias solicitados para trabalho</Label>
                    <p className="text-xs text-muted-foreground">
                      Clique para alternar: <span className="font-medium">cinza</span> = não solicitado;{' '}
                      <span className="font-medium text-emerald-700">verde</span> = solicitado para trabalho (Sáb/Dom/Feriado também — não exige justificativa);{' '}
                      <span className="font-medium text-amber-700">laranja tracejado</span> = configuração especial somente nesta solicitação (exige justificativa);{' '}
                      <span className="font-medium text-amber-700">laranja sólido com globo</span> = regra do calendário operacional do centro (governança global; somente admin altera).
                    </p>
                  </div>
                  {listaDiasGerados.length > 0 ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                        {listaDiasGerados.map((dia) => {
                          const isVerde = diasSolicitadosSelecionados.includes(dia.value);
                          const isLaranja = diasOperacionaisSelecionados.includes(dia.value);
                          const regraGlobal = regrasOperacionaisPorData[dia.value];
                          const isLaranjaGlobal =
                            !!(regraGlobal?.encontrada && regraGlobal.tipoDiaOperacional === 'operacional');
                          const isLaranjaLocal = isLaranja && !isLaranjaGlobal;
                          const diaDate = parseISO(dia.value);
                          const dow = diaDate.getDay();
                          const tipoNatural = dia.isFeriado
                            ? 'Feriado'
                            : dow === 6
                              ? 'Sáb'
                              : dow === 0
                                ? 'Dom'
                                : null;
                          const estadoTitle = isVerde
                            ? 'Solicitado normal'
                            : isLaranjaGlobal
                              ? 'Calendário operacional do centro (afeta outras solicitações)'
                              : isLaranjaLocal
                                ? 'Configuração especial somente nesta solicitação'
                                : 'Não solicitado';
                          const title = tipoNatural ? `${estadoTitle} — ${tipoNatural}` : estadoTitle;
                          return (
                            <button
                              key={dia.value}
                              type="button"
                              onClick={() => alternarDiaPeriodo(dia.value)}
                              title={title}
                              className={cn(
                                "relative flex h-11 flex-col items-center justify-center rounded-md border text-sm font-semibold transition-colors",
                                isVerde && "border-emerald-600 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600",
                                isLaranjaGlobal && "border-amber-700 bg-amber-500 text-white shadow-sm hover:bg-amber-600",
                                isLaranjaLocal && "border-2 border-dashed border-amber-600 bg-amber-500/85 text-white shadow-sm hover:bg-amber-600",
                                !isVerde && !isLaranja && "border-border bg-muted text-foreground hover:bg-accent",
                              )}
                            >
                              {isLaranjaGlobal && (
                                <Globe2 className="absolute right-0.5 top-0.5 h-3 w-3 opacity-90" aria-hidden />
                              )}
                              <span>{dia.label}</span>
                              {tipoNatural && <span className="text-[9px] opacity-80">{tipoNatural}</span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Solicitados (verde + laranja): <strong className="text-foreground">{diasSolicitadosTotais.length}</strong></span>
                        <span>Normais: <strong className="text-emerald-700">{diasSolicitadosSelecionados.length}</strong></span>
                        <span>Ponte/feriado operacional: <strong className="text-amber-700">{diasOperacionaisSelecionados.length}</strong></span>
                      </div>

                      {diasOperacionaisSelecionados.length > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="justificativa-operacional">Justificativa da configuração especial *</Label>
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
                          {justificativaOperacional.trim().length < 10 && (
                            <p className="text-xs text-destructive">
                              Informe ao menos 10 caracteres para aplicar os dias marcados como ponte/feriado operacional.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Selecione um período válido para gerar os dias automaticamente.
                    </p>
                  )}
                </div>
              )}

              {/* Justificativa Extraordinária (condicional) */}
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

              {/* Alerta de Duplicidade */}
              {duplicidadeDetectada && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Já existe uma solicitação <strong>Normal</strong> aberta para este CC nesta semana. Use Extraordinária para necessidades específicas.</p>
                    <p className="text-xs mt-1">
                      Solicitação Nº <strong>{duplicidadeDetectada.numero_solicitacao}</strong> — Para incluir novos funcionários na Normal, utilize o Apontamento de Campo.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
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
                tipoSolicitacao={tipoSolicitacao}
              />

              {/* Lista única: card "Equipe por dia" */}
              {convocadosPre.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Nenhum funcionário adicionado. Selecione ao menos um funcionário para prosseguir.
                  </AlertDescription>
                </Alert>
              ) : diasSolicitadosTotais.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Selecione pelo menos um dia no período para visualizar a matriz de equipe.
                  </AlertDescription>
                </Alert>
              ) : (
                <MatrizFuncionarioData
                  convocados={convocadosPre}
                  diasSolicitados={diasSolicitadosTotais}
                  diasVerdes={diasSolicitadosSelecionados}
                  diasLaranjas={diasOperacionaisSelecionados}
                  diasPorFuncionario={diasPorFuncionario}
                  diaAtivo={diaAtivoMatriz}
                  onChangeDiaAtivo={setDiaAtivoMatriz}
                  onToggle={toggleFuncionarioNoDia}
                  onRemover={handleRemoveFuncionario}
                  diasSemEquipe={diasSemEquipe}
                  elegibilidadeCelulaMap={elegibilidadeCelulaMap}
                  dadosRicosPorFuncionario={dadosRicosPorFuncionario}
                />
              )}

              {/* Baixo fixo: Simulação + Justificativa */}
              {convocadosPre.length > 0 && (
                <SimulacaoValores
                  simulacao={simulacao}
                  diasUteis={simulacao.diasNormaisCount}
                  diasFds={simulacao.diasExclusivosCount}
                  diasParaRefeicao={simulacao.diasRefeicaoCount}
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
            <div className="space-y-5">
              {/* Bloco principal estilo PDF */}
              <Card>
                <CardContent className="pt-5 space-y-5">
                  {/* Linha 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Centro de Custo</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {selectedCentroCusto
                          ? `${selectedCentroCusto.codigo_centro_custo} - ${selectedCentroCusto.nome_centro_custo}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Período</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {formatBrazilianDateForDisplay(dataInicio)}
                        {dataFim !== dataInicio && (
                          <> → {formatBrazilianDateForDisplay(dataFim)}</>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Solicitante</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {usuarioLogado?.nome_completo || user?.email || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Linha 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Aprovador do CC</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {aprovadorNome || 'Não definido (qualquer admin)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Responsável em Campo</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {apontadorNome || 'Não definido'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Considera FDS/Feriados</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {consideraFdsFeriado ? 'Sim' : 'Não'}
                      </p>
                    </div>
                  </div>

                  {/* Mini-cards de contagem */}
                  <div className="grid grid-cols-4 gap-3 pt-1">
                    {[
                      { label: 'Seg-Sex', value: resumoSimulacaoPeriodo.diasUteis },
                      { label: 'Sábados', value: resumoSimulacaoPeriodo.sabados },
                      { label: 'Domingos', value: resumoSimulacaoPeriodo.domingos },
                      { label: 'Feriados', value: resumoSimulacaoPeriodo.feriados + resumoSimulacaoPeriodo.diasOperacionais },
                    ].map((c) => (
                      <div key={c.label} className="rounded-lg border bg-muted/30 p-3 text-center">
                        <p className="text-2xl font-bold text-foreground leading-none">{c.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Justificativa */}
              <div className="space-y-2">
                <p className="text-sm font-bold tracking-wide text-foreground">JUSTIFICATIVA</p>
                <div className="h-0.5 bg-primary" />
                <div className="rounded-md border bg-muted/20 p-3 text-sm text-foreground">
                  {justificativa?.trim() ? justificativa : 'Não informado.'}
                </div>
              </div>

              {/* Funcionários Convocados */}
              <div className="space-y-2">
                <p className="text-sm font-bold tracking-wide text-foreground">
                  FUNCIONÁRIOS CONVOCADOS ({convocadosPre.length})
                </p>
                <div className="h-0.5 bg-primary" />
                <p className="text-xs text-muted-foreground">
                  A lista detalhada foi definida na etapa Funcionários.
                </p>
              </div>

              {/* Simulação de Valores (mantida — sem alteração de cálculo) */}
              <SimulacaoValores
                simulacao={simulacao}
                diasUteis={simulacao.diasNormaisCount}
                diasFds={simulacao.diasExclusivosCount}
                diasParaRefeicao={simulacao.diasRefeicaoCount}
              />
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
              onClick={() => {
                setAttemptedNext(true);
                if (!canProceedToDados || justificativaOperacionalInvalida) return;
                // Fase 1 — NÃO persistir mais em bd_diaria_calendario_operacional aqui.
                // O laranja é local da solicitação e vai no regras_operacionais_snapshot via buildFormData.
                console.info('[Diarias][Modal] avançando para funcionários (sem gravar calendário global)', {
                  centroCustoId,
                  dataInicio,
                  dataFim,
                  diasOperacionaisSelecionados,
                });
                setStep('funcionarios');
              }}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          
          {step === 'funcionarios' && (
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => {
                  setStep('revisao');
                }}
                disabled={!canProceedToFuncionarios}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              {diasSemEquipe.length > 0 && (
                <span className="text-[11px] text-destructive">
                  Sem equipe em {diasSemEquipe[0].split('-').reverse().join('/')}
                  {diasSemEquipe.length > 1 ? ` (+${diasSemEquipe.length - 1})` : ''}
                </span>
              )}
            </div>
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
