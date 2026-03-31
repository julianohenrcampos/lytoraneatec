import { useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, Search, Tag, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrgaosPendentes, fetchOrgaosPublicos, OrgaoPendente, OrgaoPublico } from "@/services/orgaoPublicoService";
import { formatDateTime } from "@/services/pncpService";
import TablePagination from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";

export default function OrgaosPendentes() {
  usePageTitle("Órgãos Pendentes de Classificação");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPendente, setSelectedPendente] = useState<OrgaoPendente | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrgaoId, setSelectedOrgaoId] = useState<string>("");
  const [criarAlias, setCriarAlias] = useState(true);
  const [orgaoSearch, setOrgaoSearch] = useState("");

  // Queries
  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["orgaos-pendentes", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("bd_licitacoes_orgaos_pendentes")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrgaoPendente[];
    },
  });

  const { data: orgaos = [] } = useQuery({
    queryKey: ["orgaos-publicos"],
    queryFn: fetchOrgaosPublicos,
  });

  // Filter by search
  const filtered = pendentes.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.nome_api_original.toLowerCase().includes(term) ||
      p.nome_api_normalizado.toLowerCase().includes(term) ||
      (p.licitacao_numero && p.licitacao_numero.toLowerCase().includes(term))
    );
  });

  const pagination = usePagination(filtered, { pageSize: 15 });

  // Filter orgaos for autocomplete
  const filteredOrgaos = orgaos.filter((o) => {
    if (!orgaoSearch) return true;
    const term = orgaoSearch.toLowerCase();
    return o.nome.toLowerCase().includes(term) || o.sigla.toLowerCase().includes(term);
  });

  // Mutation: classify
  const classifyMutation = useMutation({
    mutationFn: async ({ pendenteId, orgaoId, criarAlias }: { pendenteId: string; orgaoId: string; criarAlias: boolean }) => {
      const { data, error } = await supabase.rpc("classificar_orgao_pendente", {
        p_pendente_id: pendenteId,
        p_orgao_id: orgaoId,
        p_criar_alias: criarAlias,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (updatedCount) => {
      toast.success("Órgão classificado e sistema atualizado", {
        description: `${updatedCount} licitação(ões) atualizada(s) automaticamente.`,
      });
      setModalOpen(false);
      setSelectedPendente(null);
      setSelectedOrgaoId("");
      setOrgaoSearch("");
      queryClient.invalidateQueries({ queryKey: ["orgaos-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["pncp-contratacoes"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao classificar órgão", { description: error?.message });
    },
  });

  const handleOpenClassify = (pendente: OrgaoPendente) => {
    setSelectedPendente(pendente);
    setSelectedOrgaoId("");
    setCriarAlias(true);
    setOrgaoSearch("");
    setModalOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedPendente || !selectedOrgaoId) return;
    classifyMutation.mutate({
      pendenteId: selectedPendente.id,
      orgaoId: selectedOrgaoId,
      criarAlias,
    });
  };

  const selectedOrgao = orgaos.find((o) => o.id === selectedOrgaoId);

  const totalPendentes = pendentes.filter(p => p.status === "pendente").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/licitacoes/monitoramento-pncp")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div></div>
          </div>
          {totalPendentes > 0 && (
            <Badge variant="warning" className="text-sm px-3 py-1">
              {totalPendentes} pendente(s)
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do órgão ou nº licitação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="classificado">Classificados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Fila de Revisão</CardTitle>
            <CardDescription>
              {isLoading ? "Carregando..." : `${filtered.length} registro(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum órgão pendente de classificação</p>
                <p className="text-sm mt-1">Todos os órgãos foram classificados</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">Nome Original (API)</TableHead>
                        <TableHead className="min-w-[200px]">Nome Normalizado</TableHead>
                        <TableHead>Nº Licitação</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagination.paginatedData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="text-sm font-medium max-w-[300px] truncate" title={item.nome_api_original}>
                              {item.nome_api_original}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-[250px] truncate" title={item.nome_api_normalizado}>
                              {item.nome_api_normalizado}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{item.licitacao_numero || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDateTime(item.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.status === "pendente" ? (
                              <Badge variant="warning" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Classificado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.status === "pendente" && (
                              <Button size="sm" onClick={() => handleOpenClassify(item)}>
                                <Tag className="h-4 w-4 mr-1" />
                                Classificar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filtered.length > 15 && (
                  <TablePagination pagination={pagination} className="mt-4" />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Classify Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Classificar Órgão
            </DialogTitle>
            <DialogDescription>
              Vincule este nome de órgão a um órgão estratégico do sistema.
            </DialogDescription>
          </DialogHeader>

          {selectedPendente && (
            <div className="space-y-4">
              {/* Read-only fields */}
              <div>
                <Label className="text-xs text-muted-foreground">Nome Original (API)</Label>
                <p className="text-sm font-medium mt-1 p-2 bg-muted rounded-md">
                  {selectedPendente.nome_api_original}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nome Normalizado</Label>
                <p className="text-sm mt-1 p-2 bg-muted rounded-md font-mono text-xs">
                  {selectedPendente.nome_api_normalizado}
                </p>
              </div>

              {/* Organ selection with search */}
              <div>
                <Label className="text-sm font-medium">Selecionar Órgão Interno *</Label>
                <Input
                  placeholder="Buscar por nome ou sigla..."
                  value={orgaoSearch}
                  onChange={(e) => setOrgaoSearch(e.target.value)}
                  className="mt-1"
                />
                <div className="mt-2 max-h-[200px] overflow-y-auto border rounded-md divide-y">
                  {filteredOrgaos.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      Nenhum órgão encontrado
                    </p>
                  ) : (
                    filteredOrgaos.map((orgao) => (
                      <button
                        key={orgao.id}
                        type="button"
                        className={`w-full text-left p-3 hover:bg-accent transition-colors flex items-center justify-between ${
                          selectedOrgaoId === orgao.id ? "bg-primary/10 border-l-2 border-primary" : ""
                        }`}
                        onClick={() => setSelectedOrgaoId(orgao.id)}
                      >
                        <div>
                          <p className="text-sm font-medium">{orgao.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {orgao.esfera} • {orgao.area_atuacao || "Sem área"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {orgao.sigla}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
                {selectedOrgao && (
                  <p className="text-sm text-primary mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Selecionado: <strong>{selectedOrgao.sigla}</strong> — {selectedOrgao.nome}
                  </p>
                )}
              </div>

              {/* Alias checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="criar-alias"
                  checked={criarAlias}
                  onCheckedChange={(checked) => setCriarAlias(!!checked)}
                />
                <Label htmlFor="criar-alias" className="text-sm cursor-pointer">
                  Criar alias automaticamente com este nome
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2 ml-6">
                Recomendado: futuras importações com este nome serão classificadas automaticamente.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedOrgaoId || classifyMutation.isPending}
            >
              {classifyMutation.isPending ? "Classificando..." : "Confirmar Classificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
