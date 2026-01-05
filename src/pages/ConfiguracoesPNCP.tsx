import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, RotateCcw, Settings, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getConfig, updateConfig } from "@/services/pncpService";
import { PNCPConfig, TODAS_UFS, MODALIDADES_PNCP } from "@/types/pncp";
const DEFAULT_PALAVRAS = ["obra", "engenharia", "pavimentação", "reforma", "recapeamento", "drenagem", "infraestrutura", "construção", "execução", "recuperação", "manutenção", "urbanização", "saneamento", "edificação", "restauração", "asfalto", "terraplenagem", "contenção", "ponte", "viaduto"];
export default function ConfiguracoesPNCP() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<PNCPConfig>>({
    valor_minimo: 1000000,
    valor_prioridade_alta: 20000000,
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
  const [novaPalavra, setNovaPalavra] = useState("");
  const [novaPalavraExcluir, setNovaPalavraExcluir] = useState("");
  const {
    data: config,
    isLoading
  } = useQuery({
    queryKey: ["pncp-config"],
    queryFn: getConfig
  });
  useEffect(() => {
    if (config) {
      setFormData({
        valor_minimo: config.valor_minimo,
        valor_prioridade_alta: config.valor_prioridade_alta,
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
  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      queryClient.invalidateQueries({
        queryKey: ["pncp-config"]
      });
    },
    onError: error => {
      toast.error("Erro ao salvar configurações: " + error.message);
    }
  });
  const handleSave = () => {
    mutation.mutate(formData);
  };
  const handleResetDefaults = () => {
    setFormData({
      valor_minimo: 1000000,
      valor_prioridade_alta: 20000000,
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
    toast.info("Valores padrão restaurados. Clique em Salvar para confirmar.");
  };
  const toggleUF = (sigla: string) => {
    const ufs = formData.ufs_ativas || [];
    if (ufs.includes(sigla)) {
      setFormData({
        ...formData,
        ufs_ativas: ufs.filter(u => u !== sigla)
      });
    } else {
      setFormData({
        ...formData,
        ufs_ativas: [...ufs, sigla]
      });
    }
  };
  const toggleModalidade = (id: number) => {
    const modalidades = formData.modalidades_ativas || [];
    if (modalidades.includes(id)) {
      setFormData({
        ...formData,
        modalidades_ativas: modalidades.filter(m => m !== id)
      });
    } else {
      setFormData({
        ...formData,
        modalidades_ativas: [...modalidades, id]
      });
    }
  };
  const addPalavra = (tipo: 'incluir' | 'excluir') => {
    const palavra = tipo === 'incluir' ? novaPalavra.trim() : novaPalavraExcluir.trim();
    if (!palavra) return;
    const campo = tipo === 'incluir' ? 'palavras_incluir' : 'palavras_excluir';
    const lista = formData[campo] || [];
    if (!lista.includes(palavra.toLowerCase())) {
      setFormData({
        ...formData,
        [campo]: [...lista, palavra.toLowerCase()]
      });
    }
    if (tipo === 'incluir') {
      setNovaPalavra("");
    } else {
      setNovaPalavraExcluir("");
    }
  };
  const removePalavra = (palavra: string, tipo: 'incluir' | 'excluir') => {
    const campo = tipo === 'incluir' ? 'palavras_incluir' : 'palavras_excluir';
    const lista = formData[campo] || [];
    setFormData({
      ...formData,
      [campo]: lista.filter(p => p !== palavra)
    });
  };
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configurações do Monitoramento PNCP
            </h1>
            <p className="text-muted-foreground text-sm">
              Configure os parâmetros de busca e filtros para captura de licitações
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrões
            </Button>
            <Button onClick={handleSave} disabled={mutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle>Valores de Referência</CardTitle>
              <CardDescription>
                Define os limites de valor para captura e priorização de licitações
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valor_minimo">Valor Mínimo (R$)</Label>
                <Input id="valor_minimo" type="number" value={formData.valor_minimo || 0} onChange={e => setFormData({
                ...formData,
                valor_minimo: Number(e.target.value)
              })} />
                <p className="text-xs text-muted-foreground">
                  Licitações abaixo deste valor serão ignoradas
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_prioridade_alta">Valor Alta Prioridade (R$)</Label>
                <Input id="valor_prioridade_alta" type="number" value={formData.valor_prioridade_alta || 0} onChange={e => setFormData({
                ...formData,
                valor_prioridade_alta: Number(e.target.value)
              })} />
                <p className="text-xs text-muted-foreground">
                  Licitações acima deste valor são marcadas como alta prioridade
                </p>
              </div>
            </CardContent>
          </Card>

          {/* UFs Ativas */}
          <Card>
            <CardHeader>
              <CardTitle>Estados (UFs) Monitorados</CardTitle>
              <CardDescription>
                Selecione os estados onde deseja buscar licitações. 
                {formData.ufs_ativas?.length === 0 && " Nenhum selecionado = busca em todos."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {TODAS_UFS.map(uf => <label key={uf.sigla} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${formData.ufs_ativas?.includes(uf.sigla) ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}>
                    <Checkbox checked={formData.ufs_ativas?.includes(uf.sigla)} onCheckedChange={() => toggleUF(uf.sigla)} />
                    <span className="text-sm font-medium">{uf.sigla}</span>
                  </label>)}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Selecionados: {formData.ufs_ativas?.length || 0} estado(s)
              </p>
            </CardContent>
          </Card>

          {/* Modalidades */}
          <Card>
            <CardHeader>
              <CardTitle>Modalidades de Contratação</CardTitle>
              <CardDescription>
                Selecione as modalidades de licitação que deseja monitorar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODALIDADES_PNCP.map(mod => <label key={mod.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${formData.modalidades_ativas?.includes(mod.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}>
                    <Checkbox checked={formData.modalidades_ativas?.includes(mod.id)} onCheckedChange={() => toggleModalidade(mod.id)} />
                    <span className="text-sm">{mod.nome}</span>
                  </label>)}
              </div>
            </CardContent>
          </Card>

          {/* Palavras-chave para incluir */}
          <Card>
            <CardHeader>
              <CardTitle>Palavras-chave (Incluir)</CardTitle>
              <CardDescription>
                O objeto da licitação deve conter pelo menos uma dessas palavras
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input placeholder="Adicionar palavra..." value={novaPalavra} onChange={e => setNovaPalavra(e.target.value)} onKeyPress={e => e.key === "Enter" && addPalavra('incluir')} />
                <Button variant="outline" onClick={() => addPalavra('incluir')}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.palavras_incluir?.map(palavra => <Badge key={palavra} variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={() => removePalavra(palavra, 'incluir')}>
                    {palavra} ×
                  </Badge>)}
              </div>
            </CardContent>
          </Card>

          {/* Palavras-chave para excluir */}
          <Card>
            <CardHeader>
              <CardTitle>Palavras-chave (Excluir)</CardTitle>
              <CardDescription>
                Licitações que contenham essas palavras serão ignoradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input placeholder="Adicionar palavra para excluir..." value={novaPalavraExcluir} onChange={e => setNovaPalavraExcluir(e.target.value)} onKeyPress={e => e.key === "Enter" && addPalavra('excluir')} />
                <Button variant="outline" onClick={() => addPalavra('excluir')}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.palavras_excluir?.length === 0 ? <span className="text-sm text-muted-foreground">Nenhuma palavra de exclusão definida</span> : formData.palavras_excluir?.map(palavra => <Badge key={palavra} variant="destructive" className="cursor-pointer" onClick={() => removePalavra(palavra, 'excluir')}>
                      {palavra} ×
                    </Badge>)}
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
                <Input id="dias_busca_rapida" type="number" value={formData.dias_busca_rapida || 7} onChange={e => setFormData({
                ...formData,
                dias_busca_rapida: Number(e.target.value)
              })} />
                <p className="text-xs text-muted-foreground">
                  Para sincronizações frequentes (ex: a cada hora)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dias_busca_completa">Busca Completa (dias)</Label>
                <Input id="dias_busca_completa" type="number" value={formData.dias_busca_completa || 90} onChange={e => setFormData({
                ...formData,
                dias_busca_completa: Number(e.target.value)
              })} />
                <p className="text-xs text-muted-foreground">
                  Para sincronização completa diária
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo_minimo_dias">Alerta de Prazo (dias)</Label>
                <Input id="prazo_minimo_dias" type="number" value={formData.prazo_minimo_dias || 7} onChange={e => setFormData({
                ...formData,
                prazo_minimo_dias: Number(e.target.value)
              })} />
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
                    Quando ativo, o sistema buscará licitações automaticamente nos horários configurados
                  </p>
                </div>
                <Switch id="sync_automatico" checked={formData.sync_automatico || false} onCheckedChange={checked => setFormData({
                ...formData,
                sync_automatico: checked
              })} />
              </div>

              {formData.sync_automatico && <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="sync_horario_1">1º Horário (Manhã)</Label>
                    <Input id="sync_horario_1" type="time" value={formData.sync_horario_1?.substring(0, 5) || "09:00"} onChange={e => setFormData({
                  ...formData,
                  sync_horario_1: e.target.value + ":00"
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sync_horario_2">2º Horário (Tarde)</Label>
                    <Input id="sync_horario_2" type="time" value={formData.sync_horario_2?.substring(0, 5) || "14:00"} onChange={e => setFormData({
                  ...formData,
                  sync_horario_2: e.target.value + ":00"
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sync_horario_3">3º Horário (Noite)</Label>
                    <Input id="sync_horario_3" type="time" value={formData.sync_horario_3?.substring(0, 5) || "17:00"} onChange={e => setFormData({
                  ...formData,
                  sync_horario_3: e.target.value + ":00"
                })} />
                  </div>
                </div>}

              {formData.sync_automatico && <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg">
                  💡 Os cron jobs serão atualizados automaticamente ao salvar as configurações.
                  A sincronização ocorrerá nos horários: {formData.sync_horario_1?.substring(0, 5)}, {formData.sync_horario_2?.substring(0, 5)} e {formData.sync_horario_3?.substring(0, 5)}.
                </p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>;
}