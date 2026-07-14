import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  ApontamentoCaminhao,
  ApontamentoInspecao,
  ApontamentoFilterParams,
  CabecalhoApontamentoPayload,
  InspecaoApontamentoPayload,
  InspecaoDetalhadaPayload,
  fetchApontamentos,
  fetchApontamentoById,
  salvarApontamentoComInspecao,
  excluirApontamentoComInspecao,
  confirmarApontamentoPersistido,
  confirmarApontamentoDetalhadoPersistido,
  buscarFotosInspecao,
  getUltimoHorimetro,
  uploadFotoAvaria,
  uploadFotoChecklistItem,
  removerFotosStorage,
  fetchFuncionariosOperacionais,
  traduzirErroRpc,
  coletarFotosDoSnapshot,
} from "@/services/apontamentoCaminhoesService";
import { getCurrentUser } from "@/lib/auth";
import { fetchCaminhoes } from "@/services/caminhoesService";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

export interface VeiculoDropdownItem {
  id: string;
  label: string;
  searchText: string;
  situacao?: string;
  categoria_ativo_id: string | null;
  subcategoria_ativo_id: string | null;
  nome_categoria?: string | null;
  nome_subcategoria?: string | null;
  frota?: string | null;
  numero_frota?: string | null;
  placa?: string | null;
  imagem_url?: string | null;
}


export interface DetalhadoItemSubmit {
  item_codigo: string;
  status: "OK" | "NAO_OK" | "NA";
  observacao: string | null;
  fotosSalvas: string[];
  fotosNovas: File[];
  fotosRemovidas: string[];
}
export interface DetalhadoSubmit {
  template_codigo: string;
  template_versao: number;
  observacoes_gerais: string | null;
  itens: DetalhadoItemSubmit[];
}

export interface FormSubmitPayload {
  apontamentoId: string;
  cabecalho: CabecalhoApontamentoPayload;
  inspecao: InspecaoApontamentoPayload;
  arquivosNovos: File[];
  pathsMantidos: string[];
  pathsRemovidos: string[];
  detalhado?: DetalhadoSubmit;
}

export const useApontamentoCaminhoes = () => {
  const { toast } = useToast();
  const [apontamentos, setApontamentos] = useState<ApontamentoCaminhao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [veiculosDropdown, setVeiculosDropdown] = useState<VeiculoDropdownItem[]>([]);
  const [operadoresDropdown, setOperadoresDropdown] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [apontamentoToDelete, setApontamentoToDelete] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [currentApontamento, setCurrentApontamento] = useState<{
    apontamento: ApontamentoCaminhao | null;
    inspecao: ApontamentoInspecao | null;
  }>({ apontamento: null, inspecao: null });
  const [filters, setFilters] = useState<ApontamentoFilterParams>({});
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<null | {
    apontamentoId: string;
    payload: FormSubmitPayload;
  }>(null);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      loadApontamentos();
      loadVeiculos();
      loadOperadores();
      loadCurrentUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  useEffect(() => {
    loadApontamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadApontamentos = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApontamentos(filters);
      setApontamentos(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os apontamentos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadVeiculos = async () => {
    try {
      const data = await fetchCaminhoes();
      const veiculosFormatados: VeiculoDropdownItem[] = data.map((veiculo) => {
        const frotaNumero = [veiculo.frota, veiculo.numero_frota]
          .filter(Boolean)
          .join(" ")
          .trim();
        const placa = (veiculo.placa || "").trim() || "s/ placa";
        const label = frotaNumero ? `${frotaNumero} - ${placa}` : placa;
        const searchText = [
          veiculo.frota,
          veiculo.numero_frota,
          veiculo.placa,
          veiculo.nome_categoria,
          veiculo.nome_subcategoria,
        ]
          .filter(Boolean)
          .join(" ");
        return {
          id: veiculo.id,
          label,
          searchText,
          situacao: veiculo.situacao || "Operando",
          categoria_ativo_id: veiculo.categoria_ativo_id ?? null,
          subcategoria_ativo_id: veiculo.subcategoria_ativo_id ?? null,
          nome_categoria: veiculo.nome_categoria ?? null,
          nome_subcategoria: veiculo.nome_subcategoria ?? null,
          frota: veiculo.frota ?? null,
          numero_frota: veiculo.numero_frota ?? null,
          placa: veiculo.placa ?? null,
          imagem_url: (veiculo as any).imagem_url ?? null,
        };
      });
      setVeiculosDropdown(veiculosFormatados);
    } catch (error) {
      toast({
        title: "Erro ao carregar veículos",
        description: "Não foi possível carregar a lista de veículos.",
        variant: "destructive",
      });
    }
  };


  const loadOperadores = async () => {
    try {
      const operadores = await fetchFuncionariosOperacionais();
      setOperadoresDropdown(operadores);
    } catch (error) {
      toast({
        title: "Erro ao carregar operadores",
        description: "Não foi possível carregar a lista de operadores.",
        variant: "destructive",
      });
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setApontamentoToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleOpenFormModal = (id?: string) => {
    if (id) {
      loadApontamentoById(id);
    } else {
      setCurrentApontamento({ apontamento: null, inspecao: null });
    }
    setPendingRetry(null);
    setIsFormModalOpen(true);
  };

  const handleOpenDetailsModal = (id: string) => {
    loadApontamentoById(id);
    setIsDetailsModalOpen(true);
  };

  const loadApontamentoById = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await fetchApontamentoById(id);
      setCurrentApontamento(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar detalhes",
        description: "Não foi possível carregar os detalhes do apontamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!apontamentoToDelete) return;
    setIsLoading(true);
    const id = apontamentoToDelete;
    let pathsPre: string[] = [];
    try {
      pathsPre = await buscarFotosInspecao(id);
    } catch {
      pathsPre = [];
    }
    try {
      const result = await excluirApontamentoComInspecao(id);
      setApontamentos((prev) => prev.filter((item) => item.id !== id));
      const paths =
        result.fotos_paths && result.fotos_paths.length > 0 ? result.fotos_paths : pathsPre;
      if (paths.length > 0) await removerFotosStorage(paths);
      toast({
        title: "Apontamento excluído",
        description: "O apontamento foi excluído com sucesso.",
      });
    } catch (error: any) {
      try {
        const detalhes = await fetchApontamentoById(id).catch(() => null);
        if (!detalhes) {
          setApontamentos((prev) => prev.filter((item) => item.id !== id));
          if (pathsPre.length > 0) await removerFotosStorage(pathsPre);
          toast({
            title: "Apontamento excluído",
            description: "O apontamento foi excluído com sucesso.",
          });
        } else {
          toast({
            title: "Erro ao excluir",
            description: traduzirErroRpc(error, id),
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Não foi possível confirmar a exclusão",
          description: "Verifique a lista e tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsDeleteModalOpen(false);
      setApontamentoToDelete(null);
    }
  };

  const handleCreateOrUpdate = async (payload: FormSubmitPayload): Promise<void> => {
    setIsLoading(true);
    const { apontamentoId, cabecalho, inspecao, arquivosNovos, pathsMantidos, pathsRemovidos, detalhado } =
      payload;

    // ============ R3 — MODO DETALHADO ============
    if (detalhado) {
      const uploadedPaths: string[] = [];
      const itensFinal: Array<{
        item_codigo: string;
        status: "OK" | "NAO_OK" | "NA";
        observacao: string | null;
        fotos_paths: string[];
      }> = [];
      const removidos: string[] = [];
      try {
        for (const it of detalhado.itens) {
          const novos: string[] = [];
          for (const file of it.fotosNovas) {
            const p = await uploadFotoChecklistItem(apontamentoId, it.item_codigo, file);
            novos.push(p);
            uploadedPaths.push(p);
          }
          removidos.push(...it.fotosRemovidas);
          itensFinal.push({
            item_codigo: it.item_codigo,
            status: it.status,
            observacao: it.observacao,
            fotos_paths: [...it.fotosSalvas, ...novos],
          });
        }
      } catch (err: any) {
        if (uploadedPaths.length > 0) await removerFotosStorage(uploadedPaths);
        setIsLoading(false);
        toast({
          title: "Erro ao enviar fotos",
          description: err?.message || "Não foi possível enviar as imagens.",
          variant: "destructive",
        });
        throw err;
      }

      const detPayload: InspecaoDetalhadaPayload = {
        modo: "detalhado",
        template_codigo: detalhado.template_codigo,
        template_versao: detalhado.template_versao,
        observacoes_gerais: detalhado.observacoes_gerais,
        fotos_gerais: [],
        itens: itensFinal,
      };

      try {
        await salvarApontamentoComInspecao(apontamentoId, cabecalho, detPayload);
        if (removidos.length > 0) await removerFotosStorage(removidos);
        await loadApontamentos();
        setPendingRetry(null);
        setIsFormModalOpen(false);
        toast({
          title: currentApontamento.apontamento?.id
            ? "Apontamento atualizado"
            : "Apontamento criado",
          description: "Checklist detalhado salvo com sucesso.",
        });
      } catch (err: any) {
        const conf = await confirmarApontamentoDetalhadoPersistido({
          apontamentoId,
          esperado: detPayload,
        });
        if (conf.status === "match") {
          if (removidos.length > 0) await removerFotosStorage(removidos);
          await loadApontamentos();
          setPendingRetry(null);
          setIsFormModalOpen(false);
          toast({
            title: "Apontamento salvo",
            description: "Confirmado após tentativa interrompida.",
          });
          return;
        }
        if (conf.status === "mismatch") {
          const persistidas = new Set(coletarFotosDoSnapshot(conf) || conf.fotosPersistidas || []);
          const orfas = uploadedPaths.filter((p) => !persistidas.has(p));
          if (orfas.length > 0) await removerFotosStorage(orfas);
          toast({
            title: "Erro ao salvar",
            description: traduzirErroRpc(err, apontamentoId),
            variant: "destructive",
          });
          throw err;
        }
        // unknown — não apagar
        toast({
          title: "Não foi possível confirmar o salvamento",
          description: "Tente novamente. Suas fotos foram preservadas.",
          variant: "destructive",
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ============ LEGADO ============
    const novosPaths: string[] = [];
    try {
      for (const file of arquivosNovos) {
        const path = await uploadFotoAvaria(apontamentoId, file);
        novosPaths.push(path);
      }
    } catch (err: any) {
      if (novosPaths.length > 0) await removerFotosStorage(novosPaths);
      setIsLoading(false);
      toast({
        title: "Erro ao enviar fotos",
        description: err?.message || "Não foi possível enviar as imagens.",
        variant: "destructive",
      });
      throw err;
    }

    const fotosFinal = [...pathsMantidos, ...novosPaths];
    const inspecaoFinal: InspecaoApontamentoPayload = {
      ...inspecao,
      fotos_inspecao: fotosFinal,
    };

    try {
      await salvarApontamentoComInspecao(apontamentoId, cabecalho, inspecaoFinal);
      if (pathsRemovidos.length > 0) await removerFotosStorage(pathsRemovidos);
      await loadApontamentos();
      setPendingRetry(null);
      setIsFormModalOpen(false);
      toast({
        title: currentApontamento.apontamento?.id ? "Apontamento atualizado" : "Apontamento criado",
        description: "Salvo com sucesso.",
      });
    } catch (err: any) {
      const confirmacao = await confirmarApontamentoPersistido({
        apontamentoId,
        cabecalhoEsperado: cabecalho,
        inspecaoEsperada: inspecaoFinal,
      });

      if (confirmacao.status === "match") {
        if (pathsRemovidos.length > 0) await removerFotosStorage(pathsRemovidos);
        await loadApontamentos();
        setPendingRetry(null);
        setIsFormModalOpen(false);
        toast({
          title: "Apontamento salvo",
          description: "O salvamento foi confirmado após uma tentativa interrompida.",
        });
        return;
      }

      if (confirmacao.status === "mismatch") {
        const persistidas = new Set(confirmacao.fotosPersistidas || []);
        const orfas = novosPaths.filter((p) => !persistidas.has(p));
        if (orfas.length > 0) await removerFotosStorage(orfas);
        toast({
          title: "Erro ao salvar",
          description: traduzirErroRpc(err, apontamentoId),
          variant: "destructive",
        });
        throw err;
      }

      // unknown — retry sem novos uploads
      setPendingRetry({
        apontamentoId,
        payload: {
          ...payload,
          arquivosNovos: [],
          pathsMantidos: fotosFinal,
          pathsRemovidos,
        },
      });
      toast({
        title: "Não foi possível confirmar o salvamento",
        description: "Tente novamente. Suas fotos foram preservadas.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const retryPendingSave = async (): Promise<void> => {
    if (!pendingRetry) return;
    await handleCreateOrUpdate(pendingRetry.payload);
  };

  const handleGetUltimoHorimetro = async (caminhaoId: string): Promise<number | null> => {
    try {
      if (!caminhaoId) return null;
      const ultimoHorimetro = await getUltimoHorimetro(caminhaoId);
      if (ultimoHorimetro !== null) {
        toast({ title: "Horímetro carregado", description: `Último horímetro: ${ultimoHorimetro}` });
      } else {
        toast({
          title: "Sem histórico",
          description: "Nenhum apontamento anterior encontrado. Informe o valor manualmente.",
        });
      }
      return ultimoHorimetro;
    } catch (error) {
      toast({
        title: "Erro ao buscar horímetro",
        description: "Não foi possível buscar o último horímetro.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleApplyFilters = (newFilters: ApontamentoFilterParams) => {
    const processedFilters: ApontamentoFilterParams = {};
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== "_all") {
        (processedFilters as any)[key as keyof ApontamentoFilterParams] = value;
      }
    });
    setFilters(processedFilters);
    setIsFilterApplied(true);
  };

  const handleClearFilters = () => {
    setFilters({});
    setIsFilterApplied(false);
    loadApontamentos();
  };

  const handleExportToExcel = () => {
    try {
      const dataForExport = apontamentos.map((item) => ({
        Data: item.data ? formatBrazilianDateForDisplay(item.data) : "",
        "Caminhão/Equipamento": item.veiculo_identificacao || "",
        Operador: item.nome_operador || "",
        "Centro de Custo": item.nome_centro_custo || "",
        "Horímetro Inicial": item.horimetro_inicial || "",
        "Horímetro Final": item.horimetro_final || "",
        "Abastecimento (L)": item.abastecimento || "",
        "Hora Inicial": item.hora_inicial || "",
        "Hora Final": item.hora_final || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dataForExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Apontamentos");
      const fileName = `apontamentos_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ title: "Exportação concluída", description: "Os dados foram exportados." });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    }
  };

  return {
    apontamentos,
    isLoading,
    veiculosDropdown,
    operadoresDropdown,
    currentUser,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    apontamentoToDelete,
    isFormModalOpen,
    setIsFormModalOpen,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    currentApontamento,
    filters,
    isFilterApplied,
    pendingRetry,
    retryPendingSave,
    handleOpenDeleteModal,
    handleOpenFormModal,
    handleOpenDetailsModal,
    handleDelete,
    handleCreateOrUpdate,
    handleGetUltimoHorimetro,
    handleApplyFilters,
    handleClearFilters,
    handleExportToExcel,
  };
};
