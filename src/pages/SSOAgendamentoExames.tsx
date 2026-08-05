import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Button } from '@/components/ui/button';
import { AgendamentoExamesFilters, AgendamentoExamesTable } from '@/components/ssoAgendamentoExames/list';
import { BulkActionBar } from '@/components/ssoAgendamentoExames/list/BulkActionBar';
import { AgendamentoExamesDialog, AgendamentoExamesViewDialog, AgendamentoDocumentosDialog } from '@/components/ssoAgendamentoExames/dialog';
import { NovoAgendamentoDropdown } from '@/components/ssoAgendamentoExames/NovoAgendamentoDropdown';
import { useClinicasAbertasAgora } from '@/hooks/sso/useClinicasAbertasAgora';
import { FuncionarioSelectorDialog } from '@/components/ssoAgendamentoExames/FuncionarioSelectorDialog';
import { ImportStatusCarteiraModal, ImportAlterdataModal } from '@/components/ssoAgendamentoExames/import';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { AgendamentoExameFilters, TipoExame, FuncionarioSelecionado } from '@/types/ssoAgendamentoExames';
import { usePermission } from '@/hooks/usePermission';
import { FileSpreadsheet, FileText, Loader2, Filter, Download, Upload, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  usePageTitle("Agendamento de Exames");
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
  const [prefillEtapa2, setPrefillEtapa2] = useState<{ motivo_mudanca_risco?: string; funcao_nova_id?: string } | undefined>();
  const [classificacaoHandled, setClassificacaoHandled] = useState(false);

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
  const { isSuperAdmin, hasActionPermission } = usePermission();

  // [REMOVIDO 2026-05] Gate global por relógio do usuário (6h-16h BRT).
  // A validação correta acontece por clínica selecionada (dias/horários da clínica)
  // dentro do formulário de agendamento (Etapa2AgendamentoForm).

  const canCreate = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'excluir');
  const canChangeStatus = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'aprovar');

  // Bloqueio do botão "Novo Agendamento" por horário das clínicas (relógio do servidor UTC-3).
<<<<<<< HEAD
  // SuperAdm (acesso_global) bypassa para suporte.
  const { podeAgendar, motivoBloqueio } = useClinicasAbertasAgora(canCreate);
=======
  // Aplica-se a TODOS (inclui SuperAdm) — não há bypass por permissão.
  const location = useLocation();
  const navigateRoute = useNavigate();
  const hasClassificacaoState = (location.state as any)?.origem === 'classificacao';
  const { podeAgendar, motivoBloqueio } = useClinicasAbertasAgora(canCreate || hasClassificacaoState);
>>>>>>> 52562f7989b0a86f866e932d6c49a2bc9dd1bc12
  const novoAgendamentoDisabled = !podeAgendar;

  // Permissões granulares por coluna — todas derivam da mesma permissão base + ação
  const canChangeStatusExame = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'aprovar');
  const canChangeIntegracao = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'editar');
  const canChangeBeneficios = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'editar');
  const canChangeCarteira = isSuperAdmin || hasActionPermission('acesso_sso_agendamento_exames', 'editar');

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [filters]);

  // Consumir state vindo de "Baixar Classificação"
  useEffect(() => {
    if (classificacaoHandled) return;
    const st: any = location.state;
    if (st?.origem !== 'classificacao') return;
    if (!st.funcionario_payload?.nome) return; // payload incompleto → ignora silenciosamente

    // Gate por horário das clínicas — também se aplica ao fluxo de classificação.
    if (!podeAgendar) {
      console.info('[gate-clinicas][classificacao-bloqueada]', { motivoBloqueio });
      toast.error(motivoBloqueio || 'Agendamento bloqueado: clínicas fechadas no momento.');
      setClassificacaoHandled(true);
      navigateRoute(location.pathname, { replace: true, state: null });
      return;
    }

    setTipoExameSelecionado('Mudança de Risco');
    setFuncionarioSelecionado(st.funcionario_payload as FuncionarioSelecionado);
    setModoFuncionario(true);
    setPrefillEtapa2({
      motivo_mudanca_risco: st.motivo_mudanca_risco,
      funcao_nova_id: st.funcao_nova_id,
    });
    setEditingId(undefined);
    setDialogOpen(true);
    setClassificacaoHandled(true);
    navigateRoute(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, classificacaoHandled, podeAgendar]);

  // Filter agendamentos by carteira status (Desistência encerra a obrigação → não conta como pendência)
  const agendamentosFiltrados = filterSemPendencia
    ? agendamentos.filter(a => ['Registrado', 'Revisado', 'Desistencia'].includes(a.status_carteira || ''))
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
      setPrefillEtapa2(undefined);
    }
  };

  const handleEdit = (id: string) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
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
    if (!canDelete) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    try {
      await deleteAgendamento(deleteId);
      setDeleteId(null);
      setSelectedIds(prev => prev.filter(id => id !== deleteId));
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!canChangeStatus) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    try {
      await updateStatus({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (!canChangeStatus) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    try {
      await updateStatusBulk({ ids: selectedIds, status });
      setSelectedIds([]);
    } catch (error) {
      console.error('Erro ao atualizar status em massa:', error);
    }
  };

  const handleCarteiraChange = async (id: string, status: string) => {
    if (!canChangeCarteira) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    try {
      await updateStatusCarteira({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar carteira:', error);
    }
  };

  const handleIntegracoChange = async (id: string, status: string) => {
    if (!canChangeIntegracao) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    try {
      await updateIntegracao({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar integração:', error);
    }
  };

  const handleBeneficioUpdate = async (id: string, field: string, value: string | null) => {
    if (!canChangeBeneficios) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
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
      const funcNames = [...new Set(dataParaPdf.map(a => a.funcao?.toUpperCase().trim()).filter(Boolean))];
      const salarios: Record<string, number> = {};
      if (funcNames.length > 0) {
        const { data: funcoesData } = await (supabase
          .from('bd_funcoes' as any) as any)
          .select('nome_funcao, salario_base')
          .in('nome_funcao', funcNames);
        if (funcoesData) {
          funcoesData.forEach((f: any) => {
            if (f.nome_funcao && f.salario_base != null) {
              salarios[f.nome_funcao.toUpperCase().trim()] = Number(f.salario_base);
            }
          });
        }
      }

      // Fetch passagens from bd_vale_transporte by agendamento_id
      const agendamentoIds = dataParaPdf.map(a => a.id);
      const passagens: Record<string, number | null> = {};
      if (agendamentoIds.length > 0) {
        const { data: vtRecords } = await (supabase
          .from('bd_vale_transporte' as any) as any)
          .select('agendamento_id, valor_jae, valor_riocard, tipo')
          .in('agendamento_id', agendamentoIds);
        if (vtRecords) {
          (vtRecords as any[]).forEach((vt: any) => {
            if (vt.tipo === 'nao_beneficiario') {
              passagens[vt.agendamento_id] = 0;
            } else {
              passagens[vt.agendamento_id] = (Number(vt.valor_jae || 0) + Number(vt.valor_riocard || 0)) * 2;
            }
          });
        }
      }

      // Fetch centros de custo map (nome → codigo) and (codigo → nome)
      const centrosCustoMap: Record<string, string> = {};
      const centrosCustoNomeMap: Record<string, string> = {};
      const { data: ccData } = await supabase
        .from('bd_centros_custo')
        .select('nome_centro_custo, codigo_centro_custo');
      if (ccData) {
        ccData.forEach((cc: any) => {
          centrosCustoMap[cc.nome_centro_custo] = cc.codigo_centro_custo;
          centrosCustoNomeMap[cc.codigo_centro_custo] = cc.nome_centro_custo;
        });
      }

      const blob = await pdf(
        <AgendamentoExamesPDFDocument
          agendamentos={dataParaPdf}
          salarios={salarios}
          passagens={passagens}
          centrosCustoMap={centrosCustoMap}
          centrosCustoNomeMap={centrosCustoNomeMap}
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
        <div className="flex justify-end gap-4">
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} disabled={exportingPdf} className="cursor-pointer">
                  {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {canCreate && (
              <Button variant="outline" onClick={() => {
                if (!canCreate) { toast.error("Você não tem permissão para executar esta ação."); return; }
                setImportAlterdataOpen(true);
              }}>
                <Upload className="h-4 w-4 mr-2" />
                Importar Alterdata
              </Button>
            )}
            {canCreate && (
              <NovoAgendamentoDropdown
                onNovoAgendamento={handleNovoAgendamento}
                onRetorno={handleRetorno}
                onDemissional={handleDemissional}
                onPeriodico={handlePeriodico}
                onMudancaRisco={handleMudancaRisco}
                disabled={novoAgendamentoDisabled}
                tooltipReason={motivoBloqueio}
              />
            )}
          </div>
        </div>

        {/* [REMOVIDO 2026-05] Alerta global de horário comercial.
            Validação de janela acontece por clínica no formulário de agendamento. */}

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
          prefillEtapa2={prefillEtapa2}
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
