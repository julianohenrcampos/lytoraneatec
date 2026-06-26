import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUploader } from '@/components/ui/file-uploader';
import { 
  AgendamentoExameFormData, 
  Etapa1FormData, 
  Etapa2FormData,
  TipoExame,
  FuncionarioSelecionado,
  calcularDataRegistroCarteira,
  calcularDataInicioPrevista,
  mapFuncionarioToEtapa1
} from '@/types/ssoAgendamentoExames';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { agendamentoExamesService } from '@/services/ssoAgendamentoExames/agendamentoExamesService';
import { agendamentoExamesStorageService } from '@/services/ssoAgendamentoExames/agendamentoExamesStorageService';
import { valeTransporteService } from '@/services/valeTransporte/valeTransporteService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Paperclip, Trash2, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { Etapa1CadastroForm } from './Etapa1CadastroForm';
import { Etapa2AgendamentoForm } from './Etapa2AgendamentoForm';
import { DemissionalFields, DemissionalFormData, initialDemissionalData } from './DemissionalFields';
import { Badge } from '@/components/ui/badge';
import { ValeTransporteStep, ValeTransporteStepData } from '@/components/agendamento-exames/vale-transporte';
import { LinhaTransporte } from '@/components/agendamento-exames/vale-transporte/LinhaTransporteItem';
import { PENDING_HISTORICO_KEY } from '@/hooks/useBaixarClassificacao';
import { gerarPdfClassificacao } from '@/utils/pdf/gerarPdfClassificacao';
import { useAuth } from '@/hooks/useAuth';
import { validarJanelaClinica, algumaClinicaAbertaAgora } from '@/utils/sso/validarJanelaClinica';
import { useClinicasAbertasAgora } from '@/hooks/sso/useClinicasAbertasAgora';

interface AgendamentoExamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId?: string;
  canChangeStatus?: boolean;
  modoFuncionario?: boolean;
  tipoExamePreSelecionado?: TipoExame;
  funcionarioData?: FuncionarioSelecionado;
  prefillEtapa2?: {
    motivo_mudanca_risco?: string;
    funcao_nova_id?: string;
  };
}

// Estado inicial da Etapa 1
const initialEtapa1Data: Etapa1FormData = {
  nome_colaborador: '',
  telefone_celular: '',
  email: '',
  funcao: '',
  contrato: '',
  empresa: '',
  rg: '',
  cpf: '',
  data_nascimento: '',
  data_inicio_prevista: '',
  doc_titulo_eleitor: false,
  doc_pis_pasep: false,
  doc_certificado_reservista: false,
  doc_comprovante_residencia: false,
  doc_comprovante_escolaridade: false,
  doc_cnh: false,
  doc_exame_toxicologico: false,
  doc_certidao_filhos: false,
  possui_carteira_digital: false,
  possui_conta_santander: false,
  banco_agencia: '',
  banco_conta: ''
};

// Estado inicial da Etapa 2
const initialEtapa2Data: Etapa2FormData = {
  tipo_exame: 'Admissional',
  local_atendimento_id: '',
  data_agendamento: new Date().toISOString().split('T')[0],
  horario_agendamento: '08:00',
  observacoes: '',
  status: 'Pendente',
  documentos_anexados: false,
  motivo_mudanca_risco: '',
  motivo_contratacao: '',
  funcao_nova_id: ''
};

const today = new Date().toISOString().split('T')[0];

const initialVtData: ValeTransporteStepData = {
  isNaoBeneficiario: false,
  endereco: { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' },
  beneficiarioData: {
    endereco: { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' },
    linhas: [{ nome: '', numero: '', tarifa: 0, operadora: 'Jaé' } as LinhaTransporte],
    motivo: '',
    data_solicitacao: today,
  },
  naoBeneficiarioData: {
    motivos: [],
    motivo_outros_texto: '',
    data_solicitacao: today,
  },
  pdfGerado: false,
  pdfAssinadoFile: undefined,
  skipped: true,
};

export const AgendamentoExamesDialog: React.FC<AgendamentoExamesDialogProps> = ({
  open,
  onOpenChange,
  agendamentoId,
  canChangeStatus = true,
  modoFuncionario = false,
  tipoExamePreSelecionado,
  funcionarioData,
  prefillEtapa2
}) => {
  const { userId } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [etapa1Data, setEtapa1Data] = useState<Etapa1FormData>(initialEtapa1Data);
  const [etapa2Data, setEtapa2Data] = useState<Etapa2FormData>(initialEtapa2Data);
  const [vtData, setVtData] = useState<ValeTransporteStepData>(initialVtData);
  const [tecnicoSeguranca, setTecnicoSeguranca] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [demissionalData, setDemissionalData] = useState<DemissionalFormData>(initialDemissionalData);
  
  // useDesligamentos removido: gravação auxiliar em bd_desligamentos passou a ser
  // inline + não-bloqueante (ver handleSubmit), para silenciar toast global do
  // hook neste fluxo de Agendamento sem alterar o hook usado em RH/DP.

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const { 
    agendamento, locais, funcoes, empresas, centrosCusto, isLoading, create, update, isCreating, isUpdating,
    anexos, uploadAnexo, deleteAnexo, isUploadingAnexo, isDeletingAnexo
  } = useAgendamentoExames(agendamentoId);

  // Gate de relógio do servidor (UTC-3) — usado como 2ª trava no submit, caso o
  // usuário tenha aberto o dialog dentro do expediente e tente salvar depois.
  const { nowServer, clinicas: clinicasGate } = useClinicasAbertasAgora(open);

  // Detecta se origem é classificação (presença do pending no sessionStorage)
  const isFromClassificacao = useMemo(() => {
    try {
      return !!sessionStorage.getItem(PENDING_HISTORICO_KEY);
    } catch {
      return false;
    }
  }, [open]);

  const requestClose = () => {
    if (isFromClassificacao) {
      setConfirmCloseOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  const confirmCancelar = async () => {
    try {
      const raw = sessionStorage.getItem(PENDING_HISTORICO_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        if (pending?.historico_id) {
          await supabase
            .from('bd_historico_funcional')
            .delete()
            .eq('id', pending.historico_id)
            .eq('tipo_evento', 'PROMOCAO_PENDENTE');
        }
        sessionStorage.removeItem(PENDING_HISTORICO_KEY);
      }
      toast.success('Cancelado. Histórico revertido.');
    } catch (err) {
      console.error('Erro ao cancelar:', err);
      toast.error('Erro ao reverter histórico.');
    } finally {
      setConfirmCloseOpen(false);
      onOpenChange(false);
    }
  };

  // Pré-preencher dados quando for modo funcionário existente
  useEffect(() => {
    if (modoFuncionario && funcionarioData && !agendamentoId && open) {
      const mappedData = mapFuncionarioToEtapa1(funcionarioData);
      setEtapa1Data(prev => ({ ...prev, ...mappedData }));
      
      if (tipoExamePreSelecionado) {
        setEtapa2Data(prev => ({
          ...prev,
          tipo_exame: tipoExamePreSelecionado,
          ...(prefillEtapa2?.motivo_mudanca_risco
            ? { motivo_mudanca_risco: prefillEtapa2.motivo_mudanca_risco }
            : {}),
          ...(prefillEtapa2?.funcao_nova_id
            ? { funcao_nova_id: prefillEtapa2.funcao_nova_id }
            : {}),
        }));
      }

      // Auto-preencher endereço no VT a partir do funcionário
      setVtData(prev => ({
        ...prev,
        endereco: {
          rua: funcionarioData.endereco_rua || '',
          numero: funcionarioData.endereco_numero || '',
          bairro: funcionarioData.endereco_bairro || '',
          cidade: funcionarioData.endereco_cidade || '',
          estado: funcionarioData.endereco_estado || '',
          cep: funcionarioData.endereco_cep || '',
        },
      }));
      
      setCurrentStep(2);
    }
  }, [modoFuncionario, funcionarioData, tipoExamePreSelecionado, prefillEtapa2, agendamentoId, open]);

  // Buscar nome do usuário logado
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!agendamentoId && open) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', user.id)
            .single();
          
          if (profile?.nome_completo) {
            setTecnicoSeguranca(profile.nome_completo);
          }
        }
      }
    };
    fetchCurrentUser();
  }, [agendamentoId, open]);

  // Carregar dados do agendamento existente OU resetar
  useEffect(() => {
    if (agendamento && agendamentoId) {
      try {
        setEtapa1Data({
          nome_colaborador: agendamento.nome_colaborador || '',
          telefone_celular: agendamento.telefone_celular || '',
          email: agendamento.email || '',
          funcao: agendamento.funcao || '',
          contrato: agendamento.contrato || '',
          empresa: agendamento.empresa || '',
          rg: agendamento.rg || '',
          cpf: agendamento.cpf || '',
          data_nascimento: agendamento.data_nascimento || '',
          data_inicio_prevista: agendamento.data_inicio_prevista || '',
          doc_titulo_eleitor: agendamento.doc_titulo_eleitor || false,
          doc_pis_pasep: agendamento.doc_pis_pasep || false,
          doc_certificado_reservista: agendamento.doc_certificado_reservista || false,
          doc_comprovante_residencia: agendamento.doc_comprovante_residencia || false,
          doc_comprovante_escolaridade: agendamento.doc_comprovante_escolaridade || false,
          doc_cnh: agendamento.doc_cnh || false,
          doc_exame_toxicologico: agendamento.doc_exame_toxicologico || false,
          doc_certidao_filhos: agendamento.doc_certidao_filhos || false,
          possui_carteira_digital: agendamento.possui_carteira_digital || false,
          possui_conta_santander: agendamento.possui_conta_santander || false,
          banco_agencia: agendamento.banco_agencia || '',
          banco_conta: agendamento.banco_conta || ''
        });
        
        setEtapa2Data({
          tipo_exame: (agendamento.tipo_exame || 'Admissional') as any,
          local_atendimento_id: agendamento.local_atendimento_id || '',
          data_agendamento: agendamento.data_agendamento || '',
          horario_agendamento: (agendamento.horario_agendamento || '08:00').substring(0, 5),
          observacoes: agendamento.observacoes || '',
          status: agendamento.status || 'Agendado',
          documentos_anexados: agendamento.documentos_anexados || false,
          motivo_mudanca_risco: agendamento.motivo_mudanca_risco || '',
          motivo_contratacao: agendamento.motivo_contratacao || '',
          funcao_nova_id: (agendamento as any).funcao_nova_id || ''
        });
        
        setTecnicoSeguranca(agendamento.tecnico_seguranca || '');
        
        if (agendamento.etapa1_concluida) {
          setCurrentStep(2);
        }

        // Buscar dados VT existentes e popular vtData
        valeTransporteService.getByAgendamento(agendamentoId).then((vtRecord) => {
          if (vtRecord) {
            const isNaoBeneficiario = vtRecord.tipo === 'nao_beneficiario';
            const endereco = {
              rua: vtRecord.rua || '',
              numero: vtRecord.numero || '',
              bairro: vtRecord.bairro || '',
              cidade: vtRecord.cidade || '',
              estado: vtRecord.estado || '',
              cep: vtRecord.cep || '',
            };
            setVtData({
              isNaoBeneficiario,
              endereco,
              beneficiarioData: {
                endereco,
                linhas: (vtRecord.linhas && Array.isArray(vtRecord.linhas) && vtRecord.linhas.length > 0)
                  ? vtRecord.linhas
                  : [{ nome: '', numero: '', tarifa: 0, operadora: 'Jaé' } as LinhaTransporte],
                motivo: vtRecord.motivo || '',
                data_solicitacao: vtRecord.data_solicitacao || today,
              },
              naoBeneficiarioData: {
                motivos: vtRecord.motivos_nao_beneficiario || [],
                motivo_outros_texto: vtRecord.motivo_outros_texto || '',
                data_solicitacao: vtRecord.data_solicitacao || today,
              },
              pdfGerado: !!(vtRecord.pdf_assinado_url || vtRecord.pdf_gerado_url),
              pdfAssinadoFile: undefined,
              skipped: false,
            });
          }
        }).catch((err) => {
          console.error('Erro ao buscar dados VT:', err);
        });

      } catch (err) {
        console.error('Erro ao popular formulário de edição:', err);
      }
    } else if (!agendamentoId && !modoFuncionario && open) {
      setEtapa1Data(initialEtapa1Data);
      setEtapa2Data(initialEtapa2Data);
      setVtData(initialVtData);
      setCurrentStep(1);
    }
  }, [agendamento, agendamentoId, open, modoFuncionario]);

  // Validação da Etapa 1
  const isEtapa1Valid = useMemo(() => {
    if (modoFuncionario) {
      const camposEssenciais = [
        etapa1Data.nome_colaborador,
        etapa1Data.funcao,
        etapa1Data.empresa,
        etapa1Data.cpf
      ];
      return camposEssenciais.every(field => field && field.trim() !== '');
    }
    
    const requiredFields = [
      etapa1Data.nome_colaborador,
      etapa1Data.telefone_celular,
      etapa1Data.email,
      etapa1Data.funcao,
      etapa1Data.empresa,
      etapa1Data.cpf
    ];
    
    const allFieldsFilled = requiredFields.every(field => field && field.trim() !== '');
    if (!allFieldsFilled) return false;
    
    if (etapa1Data.possui_conta_santander) {
      if (!etapa1Data.banco_agencia || !etapa1Data.banco_conta) {
        return false;
      }
    }
    
    const checklistObrigatorio = [
      etapa1Data.doc_titulo_eleitor,
      etapa1Data.doc_pis_pasep,
      etapa1Data.doc_certificado_reservista,
      etapa1Data.doc_comprovante_residencia,
      etapa1Data.doc_comprovante_escolaridade,
      etapa1Data.doc_cnh,
      etapa1Data.doc_exame_toxicologico,
      etapa1Data.doc_certidao_filhos,
      etapa1Data.possui_carteira_digital
    ];
    
    return checklistObrigatorio.every(field => field === true);
  }, [etapa1Data, modoFuncionario]);

  // Validação da Etapa 2 (agora é step 2 = checklist, mas aqui mantemos a lógica original)
  const isEtapa2Valid = useMemo(() => {
    const baseValid = !!(
      etapa2Data.tipo_exame &&
      etapa2Data.local_atendimento_id &&
      etapa2Data.data_agendamento &&
      etapa2Data.horario_agendamento
    );
    if (!baseValid) return false;

    // Janela da clínica (dia + horário) — bloqueia avanço se inválido
    const clinicaSel = locais.find((l: any) => l.id === etapa2Data.local_atendimento_id);
    const janela = validarJanelaClinica(
      clinicaSel as any,
      etapa2Data.data_agendamento,
      etapa2Data.horario_agendamento,
    );
    if (!janela.ok) return false;

    if (etapa2Data.tipo_exame === 'Mudança de Risco') {
      return !!etapa2Data.motivo_mudanca_risco && !!etapa2Data.funcao_nova_id;
    }
    if (etapa2Data.tipo_exame === 'Demissional') {
      return !!demissionalData.motivo;
    }
    return true;
  }, [etapa2Data, demissionalData, locais]);

  // Validação VT (step 3) — opcional, mas se preenchido, validações se aplicam
  const isVtValid = useMemo(() => {
    if (vtData.skipped) return true;
    const hasPdf = vtData.pdfGerado || !!vtData.pdfAssinadoFile;
    if (!hasPdf) return false;
    if (vtData.isNaoBeneficiario) {
      const end = vtData.endereco;
      return !!end.rua.trim() && !!end.numero.trim() && !!end.bairro.trim() && !!end.cidade.trim() && vtData.naoBeneficiarioData.motivos.length > 0;
    }
    const end = vtData.endereco;
    const endValid = !!end.rua.trim() && !!end.numero.trim() && !!end.bairro.trim() && !!end.cidade.trim();
    if (!endValid) return false;
    return (
      vtData.beneficiarioData.linhas.length >= 1 &&
      vtData.beneficiarioData.linhas.some(l => l.nome.trim()) &&
      !!vtData.beneficiarioData.motivo
    );
  }, [vtData]);

  // Handlers
  const handleEtapa1Change = (field: keyof Etapa1FormData, value: any) => {
    setEtapa1Data(prev => ({ ...prev, [field]: value }));
  };

  const handleEtapa2Change = (field: keyof Etapa2FormData, value: any) => {
    setEtapa2Data(prev => ({ ...prev, [field]: value }));
    
    if (field === 'data_agendamento' && value && etapa2Data.tipo_exame !== 'Demissional') {
      const dataInicio = calcularDataInicioPrevista(value);
      setEtapa1Data(prev => ({ ...prev, data_inicio_prevista: dataInicio }));
    }
  };

  const handleDemissionalChange = (field: keyof DemissionalFormData, value: any) => {
    setDemissionalData(prev => ({ ...prev, [field]: value }));
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (files) {
      setPendingFiles(Array.from(files));
    } else {
      setPendingFiles([]);
    }
  };

  const isDemissional = etapa2Data.tipo_exame === 'Demissional';
  const isRetorno = etapa2Data.tipo_exame === 'Retorno ao Trabalho';
  const isMudancaRisco = etapa2Data.tipo_exame === 'Mudança de Risco';
  const skipVT = isDemissional || isRetorno || isMudancaRisco;

  const handleNextStep = () => {
    if (currentStep === 1 && !isEtapa1Valid) {
      toast.error('Preencha todos os campos obrigatórios da Etapa 1');
      return;
    }
    if (currentStep === 2 && skipVT) {
      // Pular step 3 (VT) para Demissional, Retorno ao Trabalho e Mudança de Risco
      setVtData(prev => ({ ...prev, skipped: true }));
      setCurrentStep(4);
      return;
    }
    if (currentStep === 3 && !isVtValid) {
      const missing: string[] = [];
      if (!vtData.pdfGerado && !vtData.pdfAssinadoFile) missing.push('PDF assinado');
      const end = vtData.endereco;
      if (!end.rua.trim() || !end.numero.trim() || !end.bairro.trim() || !end.cidade.trim()) missing.push('Endereço (rua, número, bairro, cidade)');
      if (!vtData.isNaoBeneficiario) {
        if (!vtData.beneficiarioData.linhas.some(l => l.nome.trim())) missing.push('Linha de transporte');
        if (!vtData.beneficiarioData.motivo) missing.push('Motivo');
      } else {
        if (vtData.naoBeneficiarioData.motivos.length === 0) missing.push('Motivo de não beneficiário');
      }
      toast.error(missing.length > 0 ? `Campos faltando: ${missing.join(', ')}` : 'Preencha os campos obrigatórios ou pule esta etapa');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handlePreviousStep = () => {
    if (currentStep === 4 && skipVT) {
      // Voltar do Finalizar direto para step 2 (pula VT)
      setCurrentStep(2);
      return;
    }
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep < 4) {
      handleNextStep();
      return;
    }
    
    if (!isEtapa1Valid || !isEtapa2Valid) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Bloqueio de janela da clínica (dia + horário) — strict no submit
    const clinicaSel = locais.find((l: any) => l.id === etapa2Data.local_atendimento_id);
    const janela = validarJanelaClinica(
      clinicaSel as any,
      etapa2Data.data_agendamento,
      etapa2Data.horario_agendamento,
      { strict: true }
    );
    console.info('[janela-clinica][submit]', {
      tipo_exame: etapa2Data.tipo_exame,
      clinicaId: etapa2Data.local_atendimento_id,
      data: etapa2Data.data_agendamento,
      hora: etapa2Data.horario_agendamento,
      dias_atendimento: (clinicaSel as any)?.dias_atendimento,
      horario_inicio: (clinicaSel as any)?.horario_inicio,
      horario_fim: (clinicaSel as any)?.horario_fim,
      ok: janela.ok,
      motivo: janela.motivo,
    });
    if (!janela.ok) {
      toast.error(janela.motivo || 'Agendamento fora da janela de atendimento da clínica.');
      return;
    }

    // 2ª trava: gate global por relógio do servidor. Só aplica em CRIAÇÃO
    // (edições de registros existentes não são bloqueadas).
    if (!agendamentoId) {
      const agora = nowServer;
      if (!agora) {
        toast.error('Não foi possível validar o horário das clínicas. Tente novamente em instantes.');
        return;
      }
      const status = algumaClinicaAbertaAgora(clinicasGate || [], agora);
      console.info('[gate-clinicas][submit]', {
        agora: agora.toISOString(),
        algumaAberta: status.algumaAberta,
        motivo: status.motivo,
        totalAtivas: status.totalAtivas,
      });
      if (!status.algumaAberta) {
        toast.error(
          status.motivo ||
            'Horário comercial encerrado. Agendamento permitido apenas com pelo menos uma clínica aberta.'
        );
        return;
      }
    }

    let diagStage = 'inicio';
    try {
      // Bloqueio de duplicidade: mesmo CPF + mesmo tipo de exame com
      // agendamento ativo (Pendente/Agendado). Ignora o próprio registro em edição.
      if (etapa1Data.cpf) {
        diagStage = 'existe_agendamento_ativo';
        console.debug('[SSO_AGENDAMENTO_DIAG]', { stage: diagStage, agendamentoId, userId });
        const existente = await agendamentoExamesService.existeAgendamentoAtivo({
          cpf: etapa1Data.cpf,
          tipo_exame: etapa2Data.tipo_exame,
          ignoreId: agendamentoId ?? null,
        });
        if (existente) {
          toast.error(
            `Já existe um agendamento ativo deste tipo de exame para este colaborador (status: ${existente.status}).`
          );
          return;
        }
      }

      const formData: AgendamentoExameFormData = {
        ...etapa1Data,
        ...etapa2Data,
        tecnico_seguranca: tecnicoSeguranca,
        data_registro_carteira: calcularDataRegistroCarteira(etapa1Data.data_inicio_prevista),
        status_carteira: 'Pendente',
        status_integracao: 'Sem integração',
        etapa_atual: 2,
        etapa1_concluida: true,
        funcao_nova_id: etapa2Data.funcao_nova_id || ''
      };
      
      let savedAgendamentoId = agendamentoId;
      
      if (agendamentoId) {
        diagStage = 'update_agendamento';
        console.debug('[SSO_AGENDAMENTO_DIAG]', { stage: diagStage, agendamentoId, userId });
        await update({ id: agendamentoId, data: formData });
      } else {
        diagStage = 'create_agendamento';
        console.debug('[SSO_AGENDAMENTO_DIAG]', { stage: diagStage, agendamentoId: null, userId });
        const newAgendamento = await create(formData);
        savedAgendamentoId = newAgendamento?.id;
      }
      
      // Demissional — gravação AUXILIAR e NÃO-BLOQUEANTE em bd_desligamentos.
      // Perfis sensíveis de RH (AdmRH/DP/Financeiro/SuperAdm) satisfazem a RLS
      // e o registro é criado normalmente. Perfis operacionais (ex.: AdmObra)
      // são bloqueados pela RLS sensível — o erro é apenas logado, sem toast,
      // e o agendamento permanece válido. Insert inline para evitar o toast
      // global do useDesligamentos (que continua valendo nas telas de RH).
      if (etapa2Data.tipo_exame === 'Demissional' && !agendamentoId && funcionarioData?.id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const hoje = new Date().toISOString().split('T')[0];
            let data_fim_aviso: string | null = null;
            let data_efetiva_prevista: string | null = hoje;
            if (demissionalData.tipo_desligamento === 'com_aviso') {
              const d = new Date();
              d.setDate(d.getDate() + (demissionalData.dias_aviso || 0));
              data_fim_aviso = d.toISOString().split('T')[0];
              data_efetiva_prevista = data_fim_aviso;
            }
            const { error: errDesl } = await supabase.from('bd_desligamentos').insert({
              funcionario_id: funcionarioData.id,
              tipo_desligamento: demissionalData.tipo_desligamento,
              dias_aviso:
                demissionalData.tipo_desligamento === 'com_aviso'
                  ? demissionalData.dias_aviso
                  : null,
              data_inicio_aviso:
                demissionalData.tipo_desligamento === 'com_aviso' ? hoje : null,
              data_fim_aviso,
              data_efetiva_desligamento: data_efetiva_prevista,
              motivo: demissionalData.motivo || null,
              recontratavel: demissionalData.recontratavel,
              observacoes: demissionalData.observacoes_desligamento || null,
              status: 'pendente_aprovacao',
              criado_por: user.id,
            } as any);
            if (errDesl) {
              console.warn(
                '[agendamento-exames][demissional] gravação auxiliar em bd_desligamentos ignorada (perfil sem permissão sensível de RH). Agendamento foi salvo normalmente.',
                errDesl.message,
              );
            }
          }
        } catch (errAux) {
          console.warn(
            '[agendamento-exames][demissional] falha não-bloqueante na gravação auxiliar de bd_desligamentos:',
            errAux,
          );
        }
      }


      // Vale Transporte (se não pulou)
      if (!vtData.skipped && savedAgendamentoId) {
        diagStage = 'salvar_vt';
        console.debug('[SSO_AGENDAMENTO_DIAG]', { stage: diagStage, agendamentoId: savedAgendamentoId, userId, vtSkipped: vtData?.skipped });
        const candidato = {
          nome: etapa1Data.nome_colaborador,
          cpf: etapa1Data.cpf,
          funcao: etapa1Data.funcao,
          empresa: etapa1Data.empresa,
          data_nascimento: etapa1Data.data_nascimento,
          telefone: etapa1Data.telefone_celular,
        };
        await valeTransporteService.salvar(savedAgendamentoId, vtData, candidato);
      }

      // Upload de arquivos pendentes
      if (pendingFiles.length > 0 && savedAgendamentoId) {
        diagStage = 'upload_anexo';
        console.debug('[SSO_AGENDAMENTO_DIAG]', { stage: diagStage, agendamentoId: savedAgendamentoId, userId, pendingFiles: pendingFiles.length });
        setIsUploadingFiles(true);
        for (const file of pendingFiles) {
          await uploadAnexo({ agendamentoId: savedAgendamentoId, file });
        }
        setIsUploadingFiles(false);
      }
      
      setPendingFiles([]);

      // Gerar PDF de Classificação se origem = classificação
      if (isFromClassificacao && !agendamentoId && funcionarioData?.id && etapa2Data.funcao_nova_id) {
        try {
          const [{ data: f }, { data: novaFn }, { data: ultimo }] = await Promise.all([
            supabase
              .from('bd_funcionarios')
              .select('nome_completo, salario_base, data_admissao, bd_funcoes(nome_funcao), bd_centros_custo(nome_centro_custo)')
              .eq('id', funcionarioData.id)
              .single(),
            supabase
              .from('bd_funcoes')
              .select('nome_funcao, salario_base')
              .eq('id', etapa2Data.funcao_nova_id)
              .single(),
            supabase
              .from('bd_historico_funcional')
              .select('created_at')
              .eq('funcionario_id', funcionarioData.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          if (f && novaFn) {
            const salarioAtual = Number(f.salario_base ?? 0);
            const novoSalario = Number(novaFn.salario_base ?? 0);
            const diff = novoSalario - salarioAtual;
            const pct = salarioAtual > 0 ? (diff / salarioAtual) * 100 : 0;
            const ultimaStr = ultimo?.created_at
              ? new Date(ultimo.created_at).toLocaleDateString('pt-BR')
              : '';

            gerarPdfClassificacao({
              nome: f.nome_completo,
              centro_custo: (f as any).bd_centros_custo?.nome_centro_custo || '-',
              data_admissao: f.data_admissao
                ? new Date(f.data_admissao).toLocaleDateString('pt-BR')
                : '-',
              ultima_classificacao: ultimaStr,
              cargo_atual: (f as any).bd_funcoes?.nome_funcao || '-',
              salario_atual: salarioAtual,
              novo_cargo: novaFn.nome_funcao,
              novo_salario: novoSalario,
              diferenca_valor: diff,
              diferenca_percentual: pct,
              data: new Date().toLocaleDateString('pt-BR'),
            });
          }
        } catch (pdfErr) {
          console.error('Erro ao gerar PDF de classificação:', pdfErr);
        }
        sessionStorage.removeItem(PENDING_HISTORICO_KEY);
      }

      onOpenChange(false);
    } catch (error: any) {
      setIsUploadingFiles(false);
      console.error('[SSO_AGENDAMENTO_DIAG][ERROR]', {
        stage: diagStage,
        agendamentoId,
        userId,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        status: error?.status,
      });
      console.error('[SSO_AGENDAMENTO][CRIAR_ERROR]', error);
      toast.error(error?.message || 'Não foi possível salvar o agendamento.');
    }
  };

  const getDialogTitle = () => {
    if (agendamentoId) return 'Editar Agendamento';
    if (modoFuncionario && tipoExamePreSelecionado) {
      return `Agendar Exame ${tipoExamePreSelecionado}`;
    }
    return 'Novo Agendamento';
  };

  const candidatoVt = useMemo(() => ({
    nome: etapa1Data.nome_colaborador,
    cpf: etapa1Data.cpf,
    funcao: etapa1Data.funcao,
    empresa: etapa1Data.empresa,
    data_nascimento: etapa1Data.data_nascimento,
    telefone: etapa1Data.telefone_celular,
  }), [etapa1Data]);

  const steps = skipVT
    ? [
        { number: 1, title: 'Cadastro', completed: isEtapa1Valid && currentStep > 1, current: currentStep === 1 },
        { number: 2, title: 'Agendamento', completed: isEtapa2Valid && currentStep > 2, current: currentStep === 2 },
        { number: 3, title: 'Finalizar', completed: false, current: currentStep === 4 }
      ]
    : [
        { number: 1, title: 'Cadastro', completed: isEtapa1Valid && currentStep > 1, current: currentStep === 1 },
        { number: 2, title: 'Agendamento', completed: isEtapa2Valid && currentStep > 2, current: currentStep === 2 },
        { number: 3, title: 'Vale Transporte', completed: (isVtValid && !vtData.skipped) && currentStep > 3, current: currentStep === 3 },
        { number: 4, title: 'Finalizar', completed: false, current: currentStep === 4 }
      ];

  const isLastStep = currentStep === 4;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose(); else onOpenChange(true); }}>
      <DialogContent
        className="max-w-3xl max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getDialogTitle()}
            {modoFuncionario && tipoExamePreSelecionado && (
              <Badge variant="info" className="ml-2">
                Funcionário Existente
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <StepIndicator 
          steps={steps} 
          onStepClick={(step) => {
            if (skipVT) {
              if (step === 1) setCurrentStep(1);
              else if (step === 2 && isEtapa1Valid) setCurrentStep(2);
              else if (step === 3 && isEtapa1Valid && isEtapa2Valid) setCurrentStep(4);
            } else {
              if (step === 1) setCurrentStep(1);
              else if (step === 2 && isEtapa1Valid) setCurrentStep(2);
              else if (step === 3 && isEtapa1Valid) setCurrentStep(3);
              else if (step === 4 && isEtapa1Valid && isEtapa2Valid) setCurrentStep(4);
            }
          }}
        />
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 && (
              <Etapa1CadastroForm
                formData={etapa1Data}
                onChange={handleEtapa1Change}
                empresas={empresas}
                funcoes={funcoes}
                centrosCusto={centrosCusto}
                modoFuncionario={modoFuncionario}
              />
            )}
            
            {currentStep === 2 && (
              <>
                <Etapa2AgendamentoForm
                  etapa1Data={etapa1Data}
                  formData={etapa2Data}
                  onChange={handleEtapa2Change}
                  locais={locais}
                  canChangeStatus={canChangeStatus}
                  motivoMudancaReadOnly={!!prefillEtapa2?.motivo_mudanca_risco}
                />
                
                {etapa2Data.tipo_exame === 'Demissional' && (
                  <DemissionalFields
                    formData={demissionalData}
                    onChange={handleDemissionalChange}
                  />
                )}
              </>
            )}

            {currentStep === 3 && (
              <ValeTransporteStep
                data={vtData}
                onChange={setVtData}
                candidato={candidatoVt}
              />
            )}

            {currentStep === 4 && (
              <>
                {/* Responsável */}
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={tecnicoSeguranca}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
                
                {/* Anexos */}
                {etapa2Data.documentos_anexados && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Anexar Documentos
                    </Label>
                    
                    <FileUploader
                      onFilesSelected={handleFilesSelected}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      maxFiles={10}
                      label="Arraste arquivos aqui ou clique para selecionar (PDF, DOC, imagens)"
                    />
                    
                    {agendamentoId && anexos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Arquivos anexados:</p>
                        <ul className="space-y-1">
                          {anexos.map((anexo) => (
                            <li key={anexo.id} className="flex items-center justify-between bg-background p-2 rounded-md border">
                              <span className="text-sm truncate flex-1">{anexo.arquivo_nome}</span>
                              <div className="flex gap-1">
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => window.open(agendamentoExamesStorageService.getPublicUrl(anexo.arquivo_path))}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => deleteAnexo(anexo)} 
                                  disabled={isDeletingAnexo}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Resumo */}
                <div className="p-4 border rounded-lg bg-muted/20 space-y-2">
                  <p className="font-medium text-sm">Resumo do Agendamento</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-muted-foreground">Nome:</span> {etapa1Data.nome_colaborador}</p>
                    <p><span className="text-muted-foreground">CPF:</span> {etapa1Data.cpf}</p>
                    <p><span className="text-muted-foreground">Tipo Exame:</span> {etapa2Data.tipo_exame}</p>
                    <p><span className="text-muted-foreground">Data:</span> {
                      etapa2Data.data_agendamento
                        ? format(new Date(etapa2Data.data_agendamento + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                    }</p>
                    {!skipVT && (
                      <p><span className="text-muted-foreground">VT:</span> {vtData.skipped ? 'Não preenchido' : vtData.isNaoBeneficiario ? 'Não beneficiário' : 'Solicitado'}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </form>
        </ScrollArea>
        
        {/* Footer padrão do modal */}
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-4 border-t">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={handlePreviousStep}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>

          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={requestClose}>
              Cancelar
            </Button>

            {!isLastStep ? (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={currentStep === 1 && !isEtapa1Valid}
              >
                {currentStep === 3 ? 'Pular / Próximo' : 'Próximo'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isCreating || isUpdating || isUploadingFiles || !isEtapa2Valid}
              >
                {(isCreating || isUpdating || isUploadingFiles) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isUploadingFiles ? 'Enviando...' : agendamentoId ? 'Salvar' : 'Criar'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação cancelará o agendamento e excluirá o histórico pendente de classificação.
            Não será possível recuperar os dados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={confirmCancelar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Sim, cancelar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
