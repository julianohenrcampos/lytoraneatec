import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useDesligamentos } from '@/hooks/useDesligamentos';
import { agendamentoExamesStorageService } from '@/services/ssoAgendamentoExames/agendamentoExamesStorageService';
import { valeTransporteService } from '@/services/valeTransporte/valeTransporteService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Paperclip, Trash2, Download, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { Etapa1CadastroForm } from './Etapa1CadastroForm';
import { Etapa2AgendamentoForm } from './Etapa2AgendamentoForm';
import { DemissionalFields, DemissionalFormData, initialDemissionalData } from './DemissionalFields';
import { Badge } from '@/components/ui/badge';
import { ValeTransporteStep, ValeTransporteStepData } from '@/components/agendamento-exames/vale-transporte';
import { LinhaTransporte } from '@/components/agendamento-exames/vale-transporte/LinhaTransporteItem';

interface AgendamentoExamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId?: string;
  canChangeStatus?: boolean;
  modoFuncionario?: boolean;
  tipoExamePreSelecionado?: TipoExame;
  funcionarioData?: FuncionarioSelecionado;
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
  motivo_mudanca_risco: ''
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
  funcionarioData
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [etapa1Data, setEtapa1Data] = useState<Etapa1FormData>(initialEtapa1Data);
  const [etapa2Data, setEtapa2Data] = useState<Etapa2FormData>(initialEtapa2Data);
  const [vtData, setVtData] = useState<ValeTransporteStepData>(initialVtData);
  const [tecnicoSeguranca, setTecnicoSeguranca] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [demissionalData, setDemissionalData] = useState<DemissionalFormData>(initialDemissionalData);
  
  const { createDesligamento } = useDesligamentos();

  const { 
    agendamento, locais, funcoes, empresas, centrosCusto, isLoading, create, update, isCreating, isUpdating,
    anexos, uploadAnexo, deleteAnexo, isUploadingAnexo, isDeletingAnexo
  } = useAgendamentoExames(agendamentoId);

  // Pré-preencher dados quando for modo funcionário existente
  useEffect(() => {
    if (modoFuncionario && funcionarioData && !agendamentoId && open) {
      const mappedData = mapFuncionarioToEtapa1(funcionarioData);
      setEtapa1Data(prev => ({ ...prev, ...mappedData }));
      
      if (tipoExamePreSelecionado) {
        setEtapa2Data(prev => ({ ...prev, tipo_exame: tipoExamePreSelecionado }));
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
  }, [modoFuncionario, funcionarioData, tipoExamePreSelecionado, agendamentoId, open]);

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
          motivo_mudanca_risco: agendamento.motivo_mudanca_risco || ''
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
    const baseValid = (
      etapa2Data.tipo_exame &&
      etapa2Data.local_atendimento_id &&
      etapa2Data.data_agendamento &&
      etapa2Data.horario_agendamento
    );
    if (etapa2Data.tipo_exame === 'Mudança de Risco') {
      return baseValid && !!etapa2Data.motivo_mudanca_risco;
    }
    if (etapa2Data.tipo_exame === 'Demissional') {
      return baseValid && !!demissionalData.motivo;
    }
    return baseValid;
  }, [etapa2Data, demissionalData]);

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

  const handleNextStep = () => {
    if (currentStep === 1 && !isEtapa1Valid) {
      toast.error('Preencha todos os campos obrigatórios da Etapa 1');
      return;
    }
    if (currentStep === 2 && isDemissional) {
      // Pular step 3 (VT) para Demissional, ir direto para Finalizar
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
    if (currentStep === 4 && isDemissional) {
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
    
    try {
      const formData: AgendamentoExameFormData = {
        ...etapa1Data,
        ...etapa2Data,
        tecnico_seguranca: tecnicoSeguranca,
        data_registro_carteira: calcularDataRegistroCarteira(etapa1Data.data_inicio_prevista),
        status_carteira: 'Pendente',
        status_integracao: 'Sem integração',
        etapa_atual: 2,
        etapa1_concluida: true
      };
      
      let savedAgendamentoId = agendamentoId;
      
      if (agendamentoId) {
        await update({ id: agendamentoId, data: formData });
      } else {
        const newAgendamento = await create(formData);
        savedAgendamentoId = newAgendamento?.id;
      }
      
      // Demissional
      if (etapa2Data.tipo_exame === 'Demissional' && !agendamentoId && funcionarioData?.id) {
        await createDesligamento.mutateAsync({
          funcionario_id: funcionarioData.id,
          tipo_desligamento: demissionalData.tipo_desligamento,
          dias_aviso: demissionalData.dias_aviso,
          motivo: demissionalData.motivo,
          recontratavel: demissionalData.recontratavel,
          observacoes: demissionalData.observacoes_desligamento,
        });
      }

      // Vale Transporte (se não pulou)
      if (!vtData.skipped && savedAgendamentoId) {
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
        setIsUploadingFiles(true);
        for (const file of pendingFiles) {
          await uploadAnexo({ agendamentoId: savedAgendamentoId, file });
        }
        setIsUploadingFiles(false);
      }
      
      setPendingFiles([]);
      onOpenChange(false);
    } catch (error) {
      setIsUploadingFiles(false);
      console.error('Erro ao salvar:', error);
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

  const steps = isDemissional
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
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

        {modoFuncionario && funcionarioData && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <User className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{funcionarioData.nome_completo}</p>
              <p className="text-sm text-muted-foreground">
                {funcionarioData.funcao} • {funcionarioData.empresa}
              </p>
            </div>
          </div>
        )}
        
        <StepIndicator 
          steps={steps} 
          onStepClick={(step) => {
            if (isDemissional) {
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
                    <p><span className="text-muted-foreground">Data:</span> {etapa2Data.data_agendamento}</p>
                    <p><span className="text-muted-foreground">VT:</span> {vtData.skipped ? 'Não preenchido' : vtData.isNaoBeneficiario ? 'Não beneficiário' : 'Solicitado'}</p>
                  </div>
                </div>
              </>
            )}
          </form>
        </ScrollArea>
        
        {/* Botões de navegação */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={handlePreviousStep}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>
          
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
