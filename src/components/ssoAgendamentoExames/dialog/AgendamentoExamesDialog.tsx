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
import { agendamentoExamesStorageService } from '@/services/ssoAgendamentoExames/agendamentoExamesStorageService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Paperclip, Trash2, Download, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { Etapa1CadastroForm } from './Etapa1CadastroForm';
import { Etapa2AgendamentoForm } from './Etapa2AgendamentoForm';
import { Badge } from '@/components/ui/badge';

interface AgendamentoExamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId?: string;
  canChangeStatus?: boolean;
  // Props para modo funcionário existente
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
  documentos_anexados: false
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
  const [tecnicoSeguranca, setTecnicoSeguranca] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  const { 
    agendamento, locais, funcoes, empresas, centrosCusto, isLoading, create, update, isCreating, isUpdating,
    anexos, uploadAnexo, deleteAnexo, isUploadingAnexo, isDeletingAnexo
  } = useAgendamentoExames(agendamentoId);

  // Pré-preencher dados quando for modo funcionário existente
  useEffect(() => {
    if (modoFuncionario && funcionarioData && !agendamentoId && open) {
      const mappedData = mapFuncionarioToEtapa1(funcionarioData);
      setEtapa1Data(prev => ({ ...prev, ...mappedData }));
      
      // Pré-selecionar tipo de exame
      if (tipoExamePreSelecionado) {
        setEtapa2Data(prev => ({ ...prev, tipo_exame: tipoExamePreSelecionado }));
      }
      
      // No modo funcionário, ir direto para Etapa 2 pois dados já estão preenchidos
      setCurrentStep(2);
    }
  }, [modoFuncionario, funcionarioData, tipoExamePreSelecionado, agendamentoId, open]);

  // Buscar nome do usuário logado ao abrir novo agendamento
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

  // Carregar dados do agendamento existente OU resetar (mas NÃO resetar quando for modo funcionário)
  useEffect(() => {
    if (agendamento && agendamentoId) {
      setEtapa1Data({
        nome_colaborador: agendamento.nome_colaborador,
        telefone_celular: agendamento.telefone_celular || '',
        email: agendamento.email || '',
        funcao: agendamento.funcao,
        contrato: agendamento.contrato || '',
        empresa: agendamento.empresa,
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
        tipo_exame: agendamento.tipo_exame,
        local_atendimento_id: agendamento.local_atendimento_id,
        data_agendamento: agendamento.data_agendamento,
        horario_agendamento: agendamento.horario_agendamento.substring(0, 5),
        observacoes: agendamento.observacoes || '',
        status: agendamento.status,
        documentos_anexados: agendamento.documentos_anexados
      });
      
      setTecnicoSeguranca(agendamento.tecnico_seguranca || '');
      
      // Se já está na etapa 2, ir direto para ela
      if (agendamento.etapa1_concluida) {
        setCurrentStep(2);
      }
    } else if (!agendamentoId && !modoFuncionario && open) {
      // Só resetar se NÃO for modo funcionário - evita sobrescrever dados pré-preenchidos
      setEtapa1Data(initialEtapa1Data);
      setEtapa2Data(initialEtapa2Data);
      setCurrentStep(1);
    }
  }, [agendamento, agendamentoId, open, modoFuncionario]);

  // Validação da Etapa 1 (data_inicio_prevista removido - será calculado na Etapa 2)
  const isEtapa1Valid = useMemo(() => {
    // Campos de dados pessoais sempre obrigatórios (menos RG)
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
    
    // Se tem conta Santander, verificar agência e conta
    if (etapa1Data.possui_conta_santander) {
      if (!etapa1Data.banco_agencia || !etapa1Data.banco_conta) {
        return false;
      }
    }
    
    // Se for funcionário existente (Retorno/Demissional/Periódico), NÃO validar checklist
    if (modoFuncionario) {
      return true;
    }
    
    // Para NOVO (Admissional), validar checklist obrigatório (menos conta Santander que já foi validado acima)
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

  // Validação da Etapa 2
  const isEtapa2Valid = useMemo(() => {
    return (
      etapa2Data.tipo_exame &&
      etapa2Data.local_atendimento_id &&
      etapa2Data.data_agendamento &&
      etapa2Data.horario_agendamento
    );
  }, [etapa2Data]);

  // Handlers
  const handleEtapa1Change = (field: keyof Etapa1FormData, value: any) => {
    setEtapa1Data(prev => ({ ...prev, [field]: value }));
  };

  const handleEtapa2Change = (field: keyof Etapa2FormData, value: any) => {
    setEtapa2Data(prev => ({ ...prev, [field]: value }));
    
    // Calcular data de início automaticamente quando data de agendamento mudar
    if (field === 'data_agendamento' && value) {
      const dataInicio = calcularDataInicioPrevista(value);
      setEtapa1Data(prev => ({ ...prev, data_inicio_prevista: dataInicio }));
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (files) {
      setPendingFiles(Array.from(files));
    } else {
      setPendingFiles([]);
    }
  };

  const handleNextStep = () => {
    if (!isEtapa1Valid) {
      toast.error('Preencha todos os campos obrigatórios da Etapa 1');
      return;
    }
    setCurrentStep(2);
  };

  const handlePreviousStep = () => {
    setCurrentStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep === 1) {
      handleNextStep();
      return;
    }
    
    if (!isEtapa1Valid || !isEtapa2Valid) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      // Combinar dados das duas etapas
      const formData: AgendamentoExameFormData = {
        ...etapa1Data,
        ...etapa2Data,
        tecnico_seguranca: tecnicoSeguranca,
        data_registro_carteira: calcularDataRegistroCarteira(etapa1Data.data_inicio_prevista),
        carteira_assinada: false,
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

  // Título do dialog baseado no modo
  const getDialogTitle = () => {
    if (agendamentoId) return 'Editar Agendamento';
    if (modoFuncionario && tipoExamePreSelecionado) {
      return `Agendar Exame ${tipoExamePreSelecionado}`;
    }
    return 'Novo Agendamento';
  };

  const steps = [
    { number: 1, title: 'Cadastro', completed: isEtapa1Valid && currentStep > 1, current: currentStep === 1 },
    { number: 2, title: 'Agendamento', completed: false, current: currentStep === 2 }
  ];

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

        {/* Info do funcionário selecionado (modo funcionário) */}
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
            if (step === 1 || isEtapa1Valid) {
              setCurrentStep(step);
            }
          }}
        />
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 ? (
              <Etapa1CadastroForm
                formData={etapa1Data}
                onChange={handleEtapa1Change}
                empresas={empresas}
                funcoes={funcoes}
                centrosCusto={centrosCusto}
                modoFuncionario={modoFuncionario}
              />
            ) : (
              <>
                <Etapa2AgendamentoForm
                  etapa1Data={etapa1Data}
                  formData={etapa2Data}
                  onChange={handleEtapa2Change}
                  locais={locais}
                  canChangeStatus={canChangeStatus}
                />
                
                {/* Seção de Responsável */}
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={tecnicoSeguranca}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
                
                {/* Seção de Anexos */}
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
              </>
            )}
          </form>
        </ScrollArea>
        
        {/* Botões de navegação */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {currentStep === 2 && (
              <Button type="button" variant="outline" onClick={handlePreviousStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {currentStep === 1 ? (
              <Button 
                type="button" 
                onClick={handleNextStep}
                disabled={!isEtapa1Valid}
              >
                Próximo
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
