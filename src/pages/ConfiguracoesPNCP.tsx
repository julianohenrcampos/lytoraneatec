import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, RotateCcw, Settings, Clock, Plus, Pencil, Trash2, ChevronDown, ChevronUp, FolderSearch, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getConfig, updateConfig, fetchPerfisBusca, createPerfilBusca, updatePerfilBusca, deletePerfilBusca, togglePerfilAtivo, fetchContratacoes } from "@/services/pncpService";
import { PNCPConfig, PNCPPerfilBusca, TODAS_UFS, MODALIDADES_PNCP, CORES_PERFIL } from "@/types/pncp";
import { downloadLicitacoesPerfilExcel } from "@/lib/excel";

const DEFAULT_PALAVRAS = [
  "obra", "engenharia", "pavimentação", "reforma", "recapeamento", "drenagem", 
  "infraestrutura", "construção", "execução", "recuperação", "manutenção", 
  "urbanização", "saneamento", "edificação", "restauração", "asfalto", 
  "terraplenagem", "contenção", "ponte", "viaduto",
  // Palavras específicas de infraestrutura
  "trecho", "ligante", "rodovia", "rodovias", "requalificação", "reabilitação",
  "duplicação", "alargamento", "adequação", "implantação", "ciclovia", 
  "passarela", "travessia", "sinalização viária"
];

const DEFAULT_PALAVRAS_EXCLUIR = [
  "ônibus", "cozinha", "hospitalar", "mobiliário", "informática",
  // Termos para evitar falsos positivos
  "limpeza", "predial", "conservação predial", "zelador", "zeladoria",
  "jardinagem", "dedetização", "portaria", "vigilância", 
  "segurança patrimonial", "material de limpeza", "higienização"
];

export default function ConfiguracoesPNCP() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Estado para configurações gerais
  const [formData, setFormData] = useState<Partial<PNCPConfig>>({
    ufs_ativas: ["RJ"],
    palavras_incluir: DEFAULT_PALAVRAS,
    palavras_excluir: [],
    modalidades_ativas: [4, 5, 6, 7, 8, 9, 12, 13],
    dias_busca_rapida: 7,
    dias_busca_completa: 90,
    prazo_minimo_dias: 7,
    sync_automatico: false,
    sync_horario_1: "09:00:00",
    sync_horario_2: "14:00:00",
    sync_horario_3: "17:00:00"
  });

  // Estado para perfis
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<PNCPPerfilBusca | null>(null);
  const [expandedPerfil, setExpandedPerfil] = useState<string | null>(null);
  const [novaPalavraChave, setNovaPalavraChave] = useState("");
  const [novaPalavraExcluir, setNovaPalavraExcluir] = useState("");
  const [downloadingPerfilId, setDownloadingPerfilId] = useState<string | null>(null);
const [perfilForm, setPerfilForm] = useState<Partial<PNCPPerfilBusca>>({
    nome: "",
    descricao: "",
    palavras_incluir: DEFAULT_PALAVRAS,
    palavras_excluir: DEFAULT_PALAVRAS_EXCLUIR,
    cor: "#3B82F6",
    ativo: true,
    valor_minimo: 1000000,
    valor_maximo: null,
  });

  // Queries
  const { data: config, isLoading } = useQuery({
    queryKey: ["pncp-config"],
    queryFn: getConfig
  });

  const { data: perfis = [], isLoading: loadingPerfis } = useQuery({
    queryKey: ["pncp-perfis"],
    queryFn: fetchPerfisBusca
  });

  useEffect(() => {
    if (config) {
      setFormData({
        ufs_ativas: config.ufs_ativas || ["RJ"],
        palavras_incluir: config.palavras_incluir || DEFAULT_PALAVRAS,
        palavras_excluir: config.palavras_excluir || [],
        modalidades_ativas: config.modalidades_ativas || [4, 5, 6, 7, 8, 9, 12, 13],
        dias_busca_rapida: config.dias_busca_rapida || 7,
        dias_busca_completa: config.dias_busca_completa || 90,
        prazo_minimo_dias: config.prazo_minimo_dias || 7,
        sync_automatico: config.sync_automatico || false,
        sync_horario_1: config.sync_horario_1 || "09:00:00",
        sync_horario_2: config.sync_horario_2 || "14:00:00",
        sync_horario_3: config.sync_horario_3 || "17:00:00"
      });
    }
  }, [config]);

  // Mutations
  const configMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pncp-config"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    }
  });

  const createPerfilMutation = useMutation({
    mutationFn: createPerfilBusca,
    onSuccess: () => {
      toast.success("Perfil criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pncp-perfis"] });
      setPerfilDialogOpen(false);
      resetPerfilForm();
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar perfil: " + error.message);
    }
  });

  const updatePerfilMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PNCPPerfilBusca> }) => updatePerfilBusca(id, data),
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pncp-perfis"] });
      setPerfilDialogOpen(false);
      setEditingPerfil(null);
      resetPerfilForm();
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar perfil: " + error.message);
    }
  });

  const deletePerfilMutation = useMutation({
    mutationFn: deletePerfilBusca,
    onSuccess: () => {
      toast.success("Perfil excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pncp-perfis"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir perfil: " + error.message);
    }
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => togglePerfilAtivo(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pncp-perfis"] });
    }
  });

  // Handlers
  const handleSave = () => {
    configMutation.mutate(formData);
  };

  const handleResetDefaults = () => {
    const defaultConfig = {
      ufs_ativas: ["RJ"],
      palavras_incluir: DEFAULT_PALAVRAS,
      palavras_excluir: [],
      modalidades_ativas: [4, 5, 6, 7, 8, 9, 12, 13],
      dias_busca_rapida: 7,
      dias_busca_completa: 90,
      prazo_minimo_dias: 7,
      sync_automatico: false,
      sync_horario_1: "09:00:00",
      sync_horario_2: "14:00:00",
      sync_horario_3: "17:00:00"
    };
    
    setFormData(defaultConfig);
    configMutation.mutate(defaultConfig);
  };

  const toggleUF = (sigla: string) => {
    const ufs = formData.ufs_ativas || [];
    if (ufs.includes(sigla)) {
      setFormData({ ...formData, ufs_ativas: ufs.filter(u => u !== sigla) });
    } else {
      setFormData({ ...formData, ufs_ativas: [...ufs, sigla] });
    }
  };

  const toggleModalidade = (id: number) => {
    const modalidades = formData.modalidades_ativas || [];
    if (modalidades.includes(id)) {
      setFormData({ ...formData, modalidades_ativas: modalidades.filter(m => m !== id) });
    } else {
      setFormData({ ...formData, modalidades_ativas: [...modalidades, id] });
    }
  };

  const resetPerfilForm = () => {
    setPerfilForm({
      nome: "",
      descricao: "",
      palavras_incluir: DEFAULT_PALAVRAS,
      palavras_excluir: DEFAULT_PALAVRAS_EXCLUIR,
      cor: "#3B82F6",
      ativo: true,
      valor_minimo: 1000000,
      valor_maximo: null,
    });
  };

  const openEditPerfil = (perfil: PNCPPerfilBusca) => {
    setEditingPerfil(perfil);
    // Combinar todas as palavras existentes (incluir + primarias + secundarias legado)
    const todasPalavras = [
      ...(perfil.palavras_incluir || []),
      ...((perfil as any).palavras_primarias || []),
      ...((perfil as any).palavras_secundarias || [])
    ];
    setPerfilForm({
      nome: perfil.nome,
      descricao: perfil.descricao || "",
      palavras_incluir: todasPalavras,
      palavras_excluir: perfil.palavras_excluir || [],
      cor: perfil.cor || "#3B82F6",
      ativo: perfil.ativo,
      valor_minimo: perfil.valor_minimo || 0,
      valor_maximo: perfil.valor_maximo || null,
    });
    setPerfilDialogOpen(true);
  };

  const openNewPerfil = () => {
    setEditingPerfil(null);
    resetPerfilForm();
    setPerfilDialogOpen(true);
  };

  const handleSavePerfil = () => {
    if (!perfilForm.nome?.trim()) {
      toast.error("Nome do perfil é obrigatório");
      return;
    }

    if (editingPerfil) {
      updatePerfilMutation.mutate({ id: editingPerfil.id, data: perfilForm });
    } else {
      createPerfilMutation.mutate(perfilForm);
    }
  };

  const addPalavraToPerfilForm = (tipo: 'incluir' | 'excluir') => {
    const texto = tipo === 'incluir' ? novaPalavraChave : novaPalavraExcluir;
    const campo: keyof typeof perfilForm = tipo === 'incluir' ? 'palavras_incluir' : 'palavras_excluir';
    
    // Dividir por vírgula e processar cada palavra
    const novasPalavras = texto
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 0);
    
    if (novasPalavras.length === 0) return;
    
    const listaAtual = (perfilForm[campo] as string[]) || [];
    const palavrasUnicas = novasPalavras.filter(p => !listaAtual.includes(p));
    
    if (palavrasUnicas.length > 0) {
      setPerfilForm({ ...perfilForm, [campo]: [...listaAtual, ...palavrasUnicas] });
    }
    
    if (tipo === 'incluir') {
      setNovaPalavraChave("");
    } else {
      setNovaPalavraExcluir("");
    }
  };

  const removePalavraFromPerfilForm = (palavra: string, tipo: 'incluir' | 'excluir') => {
    const campo: keyof typeof perfilForm = tipo === 'incluir' ? 'palavras_incluir' : 'palavras_excluir';
    const lista = (perfilForm[campo] as string[]) || [];
    setPerfilForm({ ...perfilForm, [campo]: lista.filter(p => p !== palavra) });
  };

  const handleDownloadLicitacoes = async (perfilId: string, perfilNome: string) => {
    setDownloadingPerfilId(perfilId);
    toast.loading("Buscando licitações...", { id: "download-licitacoes" });
    
    try {
      const licitacoes = await fetchContratacoes({ perfilBuscaId: perfilId });
      
      if (licitacoes.length === 0) {
        toast.dismiss("download-licitacoes");
        toast.info("Nenhuma licitação encontrada para este perfil");
        return;
      }
      
      downloadLicitacoesPerfilExcel(licitacoes, perfilNome);
      toast.dismiss("download-licitacoes");
      toast.success(`${licitacoes.length} licitações exportadas!`);
    } catch (error) {
      toast.dismiss("download-licitacoes");
      toast.error("Erro ao exportar licitações");
    } finally {
      setDownloadingPerfilId(null);
    }
  };


  if (isLoading || loadingPerfis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configurações do Monitoramento PNCP
            </h1>
            <p className="text-muted-foreground text-sm">
              Configure os parâmetros de busca e perfis para captura de licitações
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrões
            </Button>
            <Button onClick={handleSave} disabled={configMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {configMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* PERFIS DE BUSCA */}
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-5 w-5 text-primary" />
                  <CardTitle>Perfis de Busca</CardTitle>
                </div>
                <Dialog open={perfilDialogOpen} onOpenChange={setPerfilDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openNewPerfil} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Perfil
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingPerfil ? "Editar Perfil" : "Novo Perfil de Busca"}
                      </DialogTitle>
                      <DialogDescription>
                        Configure as palavras-chave e filtros específicos para este tipo de busca.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      {/* Nome e Cor */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="perfil-nome">Nome do Perfil *</Label>
                          <Input
                            id="perfil-nome"
                            placeholder="Ex: Obras, Papelaria, TI..."
                            value={perfilForm.nome || ""}
                            onChange={(e) => setPerfilForm({ ...perfilForm, nome: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cor de Identificação</Label>
                          <div className="flex gap-2 flex-wrap">
                            {CORES_PERFIL.map((cor) => (
                              <button
                                key={cor.valor}
                                type="button"
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                  perfilForm.cor === cor.valor
                                    ? "border-foreground scale-110"
                                    : "border-transparent hover:scale-105"
                                }`}
                                style={{ backgroundColor: cor.valor }}
                                onClick={() => setPerfilForm({ ...perfilForm, cor: cor.valor })}
                                title={cor.nome}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Descrição */}
                      <div className="space-y-2">
                        <Label htmlFor="perfil-descricao">Descrição (opcional)</Label>
                        <Input
                          id="perfil-descricao"
                          placeholder="Descrição do perfil..."
                          value={perfilForm.descricao || ""}
                          onChange={(e) => setPerfilForm({ ...perfilForm, descricao: e.target.value })}
                        />
                      </div>

                      {/* Palavras-chave */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Palavras-chave
                          <span className="text-xs text-muted-foreground font-normal">- basta 1 match para capturar</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Ex: obra, engenharia, pavimentação, reforma, recapeamento, drenagem, infraestrutura, construção, asfalto, terraplenagem
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: pavimentação, obra, asfalto..."
                            value={novaPalavraChave}
                            onChange={(e) => setNovaPalavraChave(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && addPalavraToPerfilForm('incluir')}
                          />
                          <Button variant="outline" onClick={() => addPalavraToPerfilForm('incluir')}>
                            Adicionar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setPerfilForm({ ...perfilForm, palavras_incluir: [] })}
                            disabled={(perfilForm.palavras_incluir?.length || 0) === 0}
                            title="Limpar todas as palavras-chave"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                          {perfilForm.palavras_incluir?.map((palavra) => (
                            <Badge
                              key={palavra}
                              variant="default"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => removePalavraFromPerfilForm(palavra, 'incluir')}
                            >
                              {palavra} ×
                            </Badge>
                          ))}
                          {(perfilForm.palavras_incluir?.length || 0) === 0 && (
                            <span className="text-sm text-muted-foreground">Nenhuma palavra-chave</span>
                          )}
                        </div>
                      </div>

                      {/* Palavras para Excluir */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Palavras de Exclusão
                          <span className="text-xs text-muted-foreground font-normal">- rejeita se encontrar</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Ex: marinha, ônibus, cozinha, hospitalar, mobiliário, informática
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: marinha, hospitalar..."
                            value={novaPalavraExcluir}
                            onChange={(e) => setNovaPalavraExcluir(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && addPalavraToPerfilForm('excluir')}
                          />
                          <Button variant="outline" onClick={() => addPalavraToPerfilForm('excluir')}>
                            Adicionar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setPerfilForm({ ...perfilForm, palavras_excluir: [] })}
                            disabled={(perfilForm.palavras_excluir?.length || 0) === 0}
                            title="Limpar todas as palavras de exclusão"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                          {perfilForm.palavras_excluir?.map((palavra) => (
                            <Badge
                              key={palavra}
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => removePalavraFromPerfilForm(palavra, 'excluir')}
                            >
                              {palavra} ×
                            </Badge>
                          ))}
                          {perfilForm.palavras_excluir?.length === 0 && (
                            <span className="text-sm text-muted-foreground">Nenhuma palavra de exclusão</span>
                          )}
                        </div>
                      </div>

                      {/* Valores de Referência do Perfil */}
                      <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="perfil-valor-minimo">Valor Mínimo (R$)</Label>
                          <Input
                            id="perfil-valor-minimo"
                            type="number"
                            placeholder="0"
                            value={perfilForm.valor_minimo || ""}
                            onChange={(e) => setPerfilForm({ ...perfilForm, valor_minimo: e.target.value ? Number(e.target.value) : 0 })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Licitações abaixo deste valor serão ignoradas para este perfil
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="perfil-valor-maximo">Valor Alta Prioridade (R$)</Label>
                          <Input
                            id="perfil-valor-maximo"
                            type="number"
                            placeholder="Opcional"
                            value={perfilForm.valor_maximo || ""}
                            onChange={(e) => setPerfilForm({ ...perfilForm, valor_maximo: e.target.value ? Number(e.target.value) : null })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Licitações acima deste valor são marcadas como alta prioridade
                          </p>
                        </div>
                      </div>

                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSavePerfil}
                        disabled={createPerfilMutation.isPending || updatePerfilMutation.isPending}
                      >
                        {createPerfilMutation.isPending || updatePerfilMutation.isPending
                          ? "Salvando..."
                          : editingPerfil
                          ? "Salvar Alterações"
                          : "Criar Perfil"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>
                Crie perfis de busca para organizar licitações por tipo (Obras, Papelaria, TI, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {perfis.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum perfil de busca criado</p>
                  <p className="text-sm">Clique em "Novo Perfil" para começar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {perfis.map((perfil) => (
                    <div
                      key={perfil.id}
                      className={`border rounded-lg transition-all ${
                        perfil.ativo ? "border-border" : "border-border/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: perfil.cor }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{perfil.nome}</span>
                              {!perfil.ativo && (
                                <Badge variant="outline" className="text-xs">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {(perfil.palavras_incluir?.length || 0) + ((perfil as any).palavras_primarias?.length || 0) + ((perfil as any).palavras_secundarias?.length || 0)} palavras-chave
                              {perfil.valor_minimo ? ` · Mín: R$ ${perfil.valor_minimo.toLocaleString('pt-BR')}` : ''}
                              {perfil.descricao && ` · ${perfil.descricao}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={perfil.ativo}
                            onCheckedChange={(checked) =>
                              toggleAtivoMutation.mutate({ id: perfil.id, ativo: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadLicitacoes(perfil.id, perfil.nome)}
                            disabled={downloadingPerfilId === perfil.id}
                            title="Baixar licitações deste perfil"
                          >
                            <Download className={`h-4 w-4 ${downloadingPerfilId === perfil.id ? "animate-pulse" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditPerfil(perfil)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir perfil "{perfil.nome}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. As licitações associadas a este perfil
                                  serão mantidas, mas perderão a associação com o perfil.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePerfilMutation.mutate(perfil.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setExpandedPerfil(expandedPerfil === perfil.id ? null : perfil.id)
                            }
                          >
                            {expandedPerfil === perfil.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Detalhes expandidos */}
                      {expandedPerfil === perfil.id && (
                        <div className="border-t p-3 bg-muted/30">
                          <div className="grid gap-3 text-sm">
                            <div>
                              <span className="font-medium">Palavras-chave: </span>
                              <span className="text-muted-foreground">
                                {[...(perfil.palavras_incluir || []), ...((perfil as any).palavras_primarias || []), ...((perfil as any).palavras_secundarias || [])].join(", ") || "Nenhuma"}
                              </span>
                            </div>
                            {perfil.palavras_excluir && perfil.palavras_excluir.length > 0 && (
                              <div>
                                <span className="font-medium">Exclusões: </span>
                                <span className="text-destructive">
                                  {perfil.palavras_excluir.join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* UFs Ativas */}
          <Card>
            <CardHeader>
              <CardTitle>Estados (UFs) Monitorados (Global)</CardTitle>
              <CardDescription>
                Selecione os estados padrão para busca (perfis podem ter UFs específicas).
                {formData.ufs_ativas?.length === 0 && " Nenhum selecionado = busca em todos."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {TODAS_UFS.map((uf) => (
                  <label
                    key={uf.sigla}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      formData.ufs_ativas?.includes(uf.sigla)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={formData.ufs_ativas?.includes(uf.sigla)}
                      onCheckedChange={() => toggleUF(uf.sigla)}
                    />
                    <span className="text-sm font-medium">{uf.sigla}</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Selecionados: {formData.ufs_ativas?.length || 0} estado(s)
              </p>
            </CardContent>
          </Card>

          {/* Modalidades */}
          <Card>
            <CardHeader>
              <CardTitle>Modalidades de Contratação (Global)</CardTitle>
              <CardDescription>
                Selecione as modalidades padrão de licitação que deseja monitorar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODALIDADES_PNCP.map((mod) => (
                  <label
                    key={mod.id}
                    className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                      formData.modalidades_ativas?.includes(mod.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={formData.modalidades_ativas?.includes(mod.id)}
                      onCheckedChange={() => toggleModalidade(mod.id)}
                    />
                    <span className="text-sm">{mod.nome}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Período de Busca */}
          <Card>
            <CardHeader>
              <CardTitle>Período de Busca</CardTitle>
              <CardDescription>
                Define quantos dias retroativos a sincronização deve buscar
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dias_busca_rapida">Busca Rápida (dias)</Label>
                <Input
                  id="dias_busca_rapida"
                  type="number"
                  value={formData.dias_busca_rapida || 7}
                  onChange={(e) =>
                    setFormData({ ...formData, dias_busca_rapida: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Para sincronizações frequentes (ex: a cada hora)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dias_busca_completa">Busca Completa (dias)</Label>
                <Input
                  id="dias_busca_completa"
                  type="number"
                  value={formData.dias_busca_completa || 90}
                  onChange={(e) =>
                    setFormData({ ...formData, dias_busca_completa: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">Para sincronização completa diária</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo_minimo_dias">Alerta de Prazo (dias)</Label>
                <Input
                  id="prazo_minimo_dias"
                  type="number"
                  value={formData.prazo_minimo_dias || 7}
                  onChange={(e) =>
                    setFormData({ ...formData, prazo_minimo_dias: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Licitações com prazo menor serão marcadas como urgentes
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sincronização Automática */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Sincronização Automática
              </CardTitle>
              <CardDescription>
                Configure a sincronização automática diária em até 3 horários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="sync_automatico" className="text-base font-medium">
                    Ativar Sincronização Automática
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativo, o sistema buscará licitações automaticamente nos horários
                    configurados
                  </p>
                </div>
                <Switch
                  id="sync_automatico"
                  checked={formData.sync_automatico || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, sync_automatico: checked })}
                />
              </div>

              {formData.sync_automatico && (
                <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="sync_horario_1">1º Horário (Manhã)</Label>
                    <Input
                      id="sync_horario_1"
                      type="time"
                      value={formData.sync_horario_1?.substring(0, 5) || "09:00"}
                      onChange={(e) =>
                        setFormData({ ...formData, sync_horario_1: e.target.value + ":00" })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sync_horario_2">2º Horário (Tarde)</Label>
                    <Input
                      id="sync_horario_2"
                      type="time"
                      value={formData.sync_horario_2?.substring(0, 5) || "14:00"}
                      onChange={(e) =>
                        setFormData({ ...formData, sync_horario_2: e.target.value + ":00" })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sync_horario_3">3º Horário (Noite)</Label>
                    <Input
                      id="sync_horario_3"
                      type="time"
                      value={formData.sync_horario_3?.substring(0, 5) || "17:00"}
                      onChange={(e) =>
                        setFormData({ ...formData, sync_horario_3: e.target.value + ":00" })
                      }
                    />
                  </div>
                </div>
              )}

              {formData.sync_automatico && (
                <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg">
                  💡 Os cron jobs serão atualizados automaticamente ao salvar as configurações. A
                  sincronização ocorrerá nos horários: {formData.sync_horario_1?.substring(0, 5)},{" "}
                  {formData.sync_horario_2?.substring(0, 5)} e{" "}
                  {formData.sync_horario_3?.substring(0, 5)}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}