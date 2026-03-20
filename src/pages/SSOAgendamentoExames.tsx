import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { AgendamentoExamesFilters, AgendamentoExamesTable } from '@/components/ssoAgendamentoExames/list';
import { BulkActionBar } from '@/components/ssoAgendamentoExames/list/BulkActionBar';
import { AgendamentoExamesDialog, AgendamentoExamesViewDialog, AgendamentoDocumentosDialog } from '@/components/ssoAgendamentoExames/dialog';
import { NovoAgendamentoDropdown } from '@/components/ssoAgendamentoExames/NovoAgendamentoDropdown';
import { FuncionarioSelectorDialog } from '@/components/ssoAgendamentoExames/FuncionarioSelectorDialog';
import { ImportStatusCarteiraModal, ImportAlterdataModal } from '@/components/ssoAgendamentoExames/import';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { AgendamentoExameFilters, TipoExame, FuncionarioSelecionado } from '@/types/ssoAgendamentoExames';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { FileSpreadsheet, FileText, Loader2, Filter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { AgendamentoExamesPDFDocument } from '@/components/ssoAgendamentoExames/pdf/AgendamentoExamesPDFDocument';
import { supabase } from '@/integrations/supabase/client';
import { ptBR } from 'date-fns/locale';
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

const SSOAgendamentoExames: React.FC = () => {
  const [filters, setFilters] = useState<AgendamentoExameFilters>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [filterSemPendencia, setFilterSemPendencia] = useState(false);
  
  // Estados para dropdown de novo agendamento
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [tipoExameSelecionado, setTipoExameSelecionado] = useState<TipoExame | null>(null);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<FuncionarioSelecionado | null>(null);
  const [modoFuncionario, setModoFuncionario] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importAlterdataOpen, setImportAlterdataOpen] = useState(false);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [docsAgendamentoId, setDocsAgendamentoId] = useState<string | undefined>();

  const { 
    agendamentos, 
    isLoading, 
    delete: deleteAgendamento, 
    updateStatus, 
    updateStatusBulk,
    updateStatusCarteira,
    updateIntegracao,
    updateBeneficio,
    isDeleting,
    isUpdatingStatusBulk 
  } = useAgendamentoExames(undefined, filters);
  const { isSuperAdmin, userRole } = useAuthPermissions();

  const canCreate = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA', 'TecEnferSSO', 'JovemAdm', 'EnferAdm', 'TecSSO', 'AdmTec', 'AdmtreinoSSO'].includes(userRole || '');
  const canEdit = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA', 'TecEnferSSO', 'AdmtreinoSSO'].includes(userRole || '');
  const canDelete = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA'].includes(userRole || '');
  const canChangeStatus = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA', 'TecEnferSSO', 'ConsultaExames', 'AdmtreinoSSO'].includes(userRole || '');
  
  // Permissões granulares por coluna
  const canChangeStatusExame = isSuperAdmin || ['SuperAdm', 'TecEnferSSO'].includes(userRole || '');
  const canChangeIntegracao = isSuperAdmin || ['SuperAdm', 'AdmtreinoSSO'].includes(userRole || '');
  const canChangeBeneficios = isSuperAdmin || ['SuperAdm', 'AdmtreinoSSO', 'AdmSSO', 'AdmOBRA'].includes(userRole || '');
  const canChangeCarteira = isSuperAdmin || ['SuperAdm', 'ConsultaExames'].includes(userRole || '');

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [filters]);

  // Filter agendamentos by carteira status
  const agendamentosFiltrados = filterSemPendencia
    ? agendamentos.filter(a => ['Registrado', 'Revisado'].includes(a.status_carteira || ''))
    : agendamentos;

  // Handlers para dropdown
  const handleNovoAgendamento = () => {
    setEditingId(undefined);
    setFuncionarioSelecionado(null);
    setTipoExameSelecionado(null);
    setModoFuncionario(false);
    setDialogOpen(true);
  };

  const handleRetorno = () => {
    setTipoExameSelecionado('Retorno ao Trabalho');
    setSelectorOpen(true);
  };

  const handleDemissional = () => {
    setTipoExameSelecionado('Demissional');
    setSelectorOpen(true);
  };

  const handlePeriodico = () => {
    setTipoExameSelecionado('Periódico');
    setSelectorOpen(true);
  };

  const handleMudancaRisco = () => {
    setTipoExameSelecionado('Mudança de Risco');
    setSelectorOpen(true);
  };

  const handleFuncionarioSelected = (funcionario: FuncionarioSelecionado) => {
    setFuncionarioSelecionado(funcionario);
    setSelectorOpen(false);
    setModoFuncionario(true);
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Limpar estados ao fechar
      setFuncionarioSelecionado(null);
      setTipoExameSelecionado(null);
      setModoFuncionario(false);
      setEditingId(undefined);
    }
  };

  const handleEdit = (id: string) => {
    setModoFuncionario(false);
    setFuncionarioSelecionado(null);
    setTipoExameSelecionado(null);
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleView = (id: string) => {
    setViewingId(id);
    setViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAgendamento(deleteId);
      setDeleteId(null);
      setSelectedIds(prev => prev.filter(id => id !== deleteId));
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      await updateStatusBulk({ ids: selectedIds, status });
      setSelectedIds([]);
    } catch (error) {
      console.error('Erro ao atualizar status em massa:', error);
    }
  };

  const handleCarteiraChange = async (id: string, status: string) => {
    try {
      await updateStatusCarteira({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar carteira:', error);
    }
  };

  const handleIntegracoChange = async (id: string, status: string) => {
    try {
      await updateIntegracao({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar integração:', error);
    }
  };

  const handleBeneficioUpdate = async (id: string, field: string, value: string | null) => {
    try {
      await updateBeneficio({ id, field, value });
    } catch (error) {
      console.error('Erro ao atualizar benefício:', error);
    }
  };

  const handleExportExcel = () => {
    if (agendamentos.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    const data = agendamentos.map(a => ({
      'Empresa': a.empresa,
      'Contrato/Obra': a.contrato || '',
      'Colaborador': a.nome_colaborador,
      'Função': a.funcao,
      'Data Nascimento': a.data_nascimento ? format(new Date(a.data_nascimento), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'RG': a.rg || '',
      'CPF': a.cpf || '',
      'Tipo Exame': a.tipo_exame,
      'Local': a.bd_locais_atendimento?.nome_local || '',
      'Data Agendamento': format(new Date(a.data_agendamento), 'dd/MM/yyyy', { locale: ptBR }),
      'Hora': a.horario_agendamento.substring(0, 5),
      'Status': a.status,
      'Responsável': a.tecnico_seguranca || '',
      'Docs Anexados': a.documentos_anexados ? 'Sim' : 'Não',
      'Observações': a.observacoes || '',
      'Status Carteira': a.status_carteira || 'Pendente'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `agendamentos_exames_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Arquivo exportado com sucesso!');
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPDF = async () => {
    const dataParaPdf = selectedIds.length > 0
      ? agendamentosFiltrados.filter(a => selectedIds.includes(a.id))
      : agendamentosFiltrados;

    if (dataParaPdf.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    setExportingPdf(true);
    try {
      // Fetch salarios from bd_funcoes (keyed by nome_funcao)
      const funcNames = [...new Set(dataParaPdf.map(a => a.funcao).filter(Boolean))];
      const salarios: Record<string, number> = {};
      if (funcNames.length > 0) {
        const { data: funcoesData } = await (supabase
          .from('bd_funcoes' as any) as any)
          .select('nome_funcao, salario_base')
          .in('nome_funcao', funcNames);
        if (funcoesData) {
          funcoesData.forEach((f: any) => {
            if (f.nome_funcao && f.salario_base != null) {
              salarios[f.nome_funcao] = Number(f.salario_base);
            }
          });
        }
      }

      // Fetch passagens (custo_passagem) from bd_funcionarios by CPF
      const cpfs = [...new Set(dataParaPdf.map(a => a.cpf?.replace(/\D/g, '')).filter(Boolean))] as string[];
      const passagens: Record<string, number | null> = {};
      if (cpfs.length > 0) {
        const { data: funcs } = await (supabase
          .from('bd_funcionarios' as any) as any)
          .select('cpf, custo_passagem')
          .in('cpf', cpfs);
        if (funcs) {
          funcs.forEach((f: any) => {
            if (f.cpf) {
              passagens[f.cpf.replace(/\D/g, '')] = f.custo_passagem != null ? Number(f.custo_passagem) : null;
            }
          });
        }
      }

      // Build filter description
      const parts: string[] = [];
      if (filters.contrato) parts.push(`Centro de Custo: ${filters.contrato}`);
      if (filters.data_inicio || filters.data_fim) {
        const di = filters.data_inicio ? format(new Date(filters.data_inicio + 'T12:00:00'), 'dd/MM/yyyy') : '—';
        const df = filters.data_fim ? format(new Date(filters.data_fim + 'T12:00:00'), 'dd/MM/yyyy') : '—';
        parts.push(`Período: ${di} a ${df}`);
      }
      if (filters.status && filters.status !== 'all') parts.push(`Status: ${filters.status}`);
      if (filters.nome_colaborador) parts.push(`Colaborador: ${filters.nome_colaborador}`);
      const filtrosTexto = parts.length > 0 ? `Filtros: ${parts.join(' | ')}` : `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;

      const blob = await pdf(
        <AgendamentoExamesPDFDocument
          agendamentos={dataParaPdf}
          salarios={salarios}
          passagens={passagens}
          filtrosTexto={filtrosTexto}
        />
      ).toBlob();

      saveAs(blob, `relatorio_admissao_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agendamento de Exames</h1>
            <p className="text-muted-foreground">Gerencie os agendamentos de exames ocupacionais</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={exportingPdf}>
              {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => setImportModalOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Importar Excel
            </Button>
            <Button variant="outline" onClick={() => setImportAlterdataOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Importar Alterdata
            </Button>
            {canCreate && (
              <NovoAgendamentoDropdown
                onNovoAgendamento={handleNovoAgendamento}
                onRetorno={handleRetorno}
                onDemissional={handleDemissional}
                onPeriodico={handlePeriodico}
                onMudancaRisco={handleMudancaRisco}
              />
            )}
          </div>
        </div>

        {/* Filters */}
        <AgendamentoExamesFilters
          onFilterChange={setFilters}
          onClearFilters={() => setFilters({})}
        />

        {/* PDF Selection Controls */}
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-2">
            <Switch
              id="filter-sem-pendencia"
              checked={filterSemPendencia}
              onCheckedChange={(checked) => {
                setFilterSemPendencia(checked);
                setSelectedIds([]);
              }}
            />
            <Label htmlFor="filter-sem-pendencia" className="text-sm cursor-pointer">
              Apenas sem pendência de carteira
            </Label>
          </div>
          {selectedIds.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selecionado(s) para PDF
            </span>
          )}
        </div>

        {/* Bulk Action Bar */}
        {canChangeStatus && (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onStatusChange={handleBulkStatusChange}
            onClearSelection={() => setSelectedIds([])}
            isLoading={isUpdatingStatusBulk}
          />
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <AgendamentoExamesTable
            agendamentos={agendamentosFiltrados}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteId(id)}
            onAnexos={(id) => { setDocsAgendamentoId(id); setDocsDialogOpen(true); }}
            onStatusChange={handleStatusChange}
            onCarteiraChange={handleCarteiraChange}
            onIntegracoChange={handleIntegracoChange}
            onBeneficioUpdate={handleBeneficioUpdate}
            canEdit={canEdit}
            canDelete={canDelete}
            canChangeStatus={canChangeStatus}
            canChangeStatusExame={canChangeStatusExame}
            canChangeIntegracao={canChangeIntegracao}
            canChangeBeneficios={canChangeBeneficios}
            canChangeCarteira={canChangeCarteira}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        )}

        {/* Funcionario Selector Dialog */}
        {tipoExameSelecionado && (
          <FuncionarioSelectorDialog
            open={selectorOpen}
            onOpenChange={setSelectorOpen}
            tipoExame={tipoExameSelecionado}
            onSelect={handleFuncionarioSelected}
          />
        )}

        {/* Edit/Create Dialog */}
        <AgendamentoExamesDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          agendamentoId={editingId}
          canChangeStatus={canChangeStatus}
          modoFuncionario={modoFuncionario}
          tipoExamePreSelecionado={tipoExameSelecionado || undefined}
          funcionarioData={funcionarioSelecionado || undefined}
        />

        {/* View Dialog */}
        <AgendamentoExamesViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          agendamentoId={viewingId}
        />

        {/* Import Status Carteira Modal */}
        <ImportStatusCarteiraModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          agendamentos={agendamentos}
          updateStatusCarteira={updateStatusCarteira}
        />

        {/* Import Alterdata Modal */}
        <ImportAlterdataModal
          open={importAlterdataOpen}
          onOpenChange={setImportAlterdataOpen}
        />

        {/* Documentos Dialog */}
        <AgendamentoDocumentosDialog
          open={docsDialogOpen}
          onOpenChange={setDocsDialogOpen}
          agendamentoId={docsAgendamentoId}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default SSOAgendamentoExames;
