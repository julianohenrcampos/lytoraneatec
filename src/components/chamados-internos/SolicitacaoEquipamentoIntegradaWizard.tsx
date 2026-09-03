/**
 * Fluxo ÚNICO e integrado: Chamado Interno (protocolo mestre) + Solicitação de
 * Equipamento (referência técnica) em 3 etapas — Solicitação, Dados
 * Operacionais e Revisão — com uma única chamada à RPC transacional
 * `fn_chamado_interno_abrir_solic_equipamento` (via service existente).
 *
 * Nenhuma regra de negócio vive aqui: itens usam o mesmo `ItemBuilderSubForm`,
 * atendimento preferencial usa `AtendimentoPreferencialSelect` e a previsão de
 * aprovação vem do motor corporativo (`fn_solic_equip_aprovacao_preview`).
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import ChamadoAnexosInput from "@/components/chamados-internos/ChamadoAnexosInput";
import ItemSolicitacaoEditorDialog, {
  type ItemComDisplay,
} from "@/components/chamados-internos/ItemSolicitacaoEditorDialog";
import AtendimentoPreferencialSelect, {
  ATENDIMENTO_AVALIAR,
  resolveDepartamentoPreferencialId,
} from "@/components/solicitacoes-equipamento/AtendimentoPreferencialSelect";
import { getDepartamentosFornecedoresEquipamento } from "@/services/atendimentoPreferencialService";
import { getUsuariosOperacionais } from "@/services/solicitacaoEquipamentoService";
import { abrirChamadoComSolicitacaoEquipamento } from "@/services/chamadoOperacionalService";
import { useAprovacaoPreview } from "@/hooks/useChamadoOperacional";
import {
  useChamadoInternoAnexar,
  useChamadoInternoCcsAbertura,
  useChamadoInternoSolicitantesDoCc,
} from "@/hooks/useChamadosInternos";
import { REGIME_LABELS, type RegimeTrabalho } from "@/services/solicitacaoItensService";
import { formatItemDisplay, isNaoCadastrado } from "@/utils/solicitacaoItemDisplay";
import { formatDateBR } from "@/utils/formatDateBR";
import type { ChamadoInternoCategoriaRow } from "@/types/chamadosInternos";

type Passo = 1 | 2 | 3;

const PASSOS: { n: Passo; label: string }[] = [
  { n: 1, label: "Solicitação" },
  { n: 2, label: "Dados operacionais" },
  { n: 3, label: "Revisão" },
];

const PRIORIDADE_LABEL: Record<string, string> = {
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

interface Props {
  categoria: ChamadoInternoCategoriaRow;
  onVoltarCategoria: () => void;
}

interface Sucesso {
  chamadoId: string;
  protocolo: string;
  referencia: string;
}

const SolicitacaoEquipamentoIntegradaWizard: React.FC<Props> = ({
  categoria,
  onVoltarCategoria,
}) => {
  const navigate = useNavigate();

  // ---------- Estado único do wizard (nada persiste antes do envio) ----------
  const [passo, setPasso] = React.useState<Passo>(1);
  const [centroCustoId, setCentroCustoId] = React.useState("");
  const [solicitanteId, setSolicitanteId] = React.useState("");
  const [titulo, setTitulo] = React.useState("Solicitação de Equipamento");
  const [descricao, setDescricao] = React.useState("");
  const [anexos, setAnexos] = React.useState<File[]>([]);
  const [itens, setItens] = React.useState<ItemComDisplay[]>([]);
  const [dataInicio, setDataInicio] = React.useState("");
  const [prioridade, setPrioridade] = React.useState("NORMAL");
  const [engenheiroId, setEngenheiroId] = React.useState("");
  const [apontadorId, setApontadorId] = React.useState("");
  const [justificativa, setJustificativa] = React.useState("");
  const [atendimento, setAtendimento] = React.useState(ATENDIMENTO_AVALIAR);

  const [editorAberto, setEditorAberto] = React.useState(false);
  const [editandoIndex, setEditandoIndex] = React.useState<number | null>(null);
  const [removerIndex, setRemoverIndex] = React.useState<number | null>(null);
  const [erroPasso1, setErroPasso1] = React.useState("");
  const [erroPasso2, setErroPasso2] = React.useState("");
  const [erroSubmit, setErroSubmit] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<Sucesso | null>(null);

  // ---------- Fontes de dados existentes ----------
  const ccsQ = useChamadoInternoCcsAbertura();
  const solicitantesQ = useChamadoInternoSolicitantesDoCc(centroCustoId || undefined);
  const anexarM = useChamadoInternoAnexar();

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-operacionais-solic-equip"],
    queryFn: getUsuariosOperacionais,
  });
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos-fornecedores-equipamento"],
    queryFn: getDepartamentosFornecedoresEquipamento,
    staleTime: 5 * 60_000,
  });

  const ccOptions: ComboboxOption[] = React.useMemo(
    () =>
      (ccsQ.data ?? []).map((c) => ({
        value: c.centro_custo_id,
        label: `${c.codigo_centro_custo} — ${c.nome_centro_custo}`,
        searchText: `${c.codigo_centro_custo} ${c.nome_centro_custo}`,
      })),
    [ccsQ.data],
  );

  const solicitanteOptions: ComboboxOption[] = React.useMemo(
    () => (solicitantesQ.data ?? []).map((f) => ({ value: f.id, label: f.nome_completo })),
    [solicitantesQ.data],
  );

  const engenheiroOptions: ComboboxOption[] = React.useMemo(
    () =>
      usuarios
        .filter((u) => {
          const funcao = (u.funcao_nome || "").toLowerCase();
          return funcao.includes("engenheiro") || funcao.includes("gerente regional");
        })
        .map((u) => ({ value: u.profile_id, label: u.nome_completo || "Sem nome" })),
    [usuarios],
  );

  const apontadorOptions: ComboboxOption[] = React.useMemo(
    () => usuarios.map((u) => ({ value: u.profile_id, label: u.nome_completo || "Sem nome" })),
    [usuarios],
  );

  const label = (options: ComboboxOption[], value: string) =>
    options.find((o) => o.value === value)?.label ?? "—";

  const atendimentoLabel =
    !atendimento || atendimento === ATENDIMENTO_AVALIAR
      ? "Avaliar disponibilidade"
      : departamentos.find((d) => d.id === atendimento)?.nome ?? "—";

  // ---------- Previsão de aprovação (motor corporativo, read-only) ----------
  const previewQ = useAprovacaoPreview(
    centroCustoId || null,
    { engenheiro_solicitante_id: engenheiroId || null },
    passo === 3 && !!centroCustoId,
  );

  // ---------- Itens (somente estado local até o envio) ----------
  const salvarItem = (item: ItemComDisplay) => {
    setItens((prev) =>
      editandoIndex !== null
        ? prev.map((it, i) => (i === editandoIndex ? item : it))
        : [...prev, item],
    );
    setEditorAberto(false);
    setEditandoIndex(null);
    setErroPasso1("");
  };

  const tituloTrim = titulo.trim();
  const descricaoTrim = descricao.trim();

  const validarPasso1 = () => {
    if (!centroCustoId || !solicitanteId || !tituloTrim || !descricaoTrim) {
      setErroPasso1("Preencha centro de custo, solicitante, título e descrição.");
      return false;
    }
    if (itens.length === 0) {
      setErroPasso1("Adicione pelo menos um item à solicitação.");
      return false;
    }
    setErroPasso1("");
    return true;
  };

  const validarPasso2 = () => {
    if (!atendimento) {
      setErroPasso2("Selecione o atendimento preferencial.");
      return false;
    }
    if (!dataInicio) {
      setErroPasso2("Informe a data de início.");
      return false;
    }
    if (!engenheiroId) {
      setErroPasso2("Selecione o engenheiro solicitante.");
      return false;
    }
    if (!apontadorId) {
      setErroPasso2("Selecione o apontador responsável.");
      return false;
    }
    if (!justificativa.trim()) {
      setErroPasso2("Informe a justificativa da solicitação.");
      return false;
    }
    setErroPasso2("");
    return true;
  };

  // ---------- Envio: uma única transação ----------
  const handleEnviar = async () => {
    if (enviando) return;
    if (!validarPasso1()) {
      setPasso(1);
      return;
    }
    if (!validarPasso2()) {
      setPasso(2);
      return;
    }
    setEnviando(true);
    setErroSubmit("");
    try {
      const solicitacaoId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;

      const itensLimpos = itens.map(({ _displayName, ...rest }) => rest);
      const tempoPrevisto = itensLimpos.reduce<number | null>(
        (acc, i) => (i.tempo_previsto_dias ? Math.max(acc ?? 0, i.tempo_previsto_dias) : acc),
        null,
      );

      const res = await abrirChamadoComSolicitacaoEquipamento({
        centro_custo_id: centroCustoId,
        categoria_id: categoria.id,
        solicitante_funcionario_id: solicitanteId,
        titulo: tituloTrim,
        descricao: descricaoTrim,
        solicitacao_id: solicitacaoId,
        tipo_equipamento_id: null,
        data_inicio: dataInicio,
        tempo_previsto_dias: tempoPrevisto,
        regime_trabalho: itensLimpos[0]?.regime_trabalho ?? null,
        com_operador: itensLimpos.some((i) => i.com_operador),
        prioridade,
        justificativa: justificativa.trim(),
        engenheiro_solicitante_id: engenheiroId,
        apontador_responsavel_id: apontadorId,
        departamento_atendimento_preferencial_id:
          resolveDepartamentoPreferencialId(atendimento),
        itens: itensLimpos,
      });

      if (anexos.length > 0) {
        try {
          await anexarM.mutateAsync({ chamadoId: res.chamado_id, arquivos: anexos });
        } catch {
          toast.warning("Solicitação criada, mas houve falha ao enviar os anexos", {
            description: "Você pode reenviar os arquivos pela tela do chamado.",
          });
        }
      }

      toast.success("Solicitação criada com sucesso", {
        description: `${res.protocolo} · ${res.referencia_tecnica}`,
      });
      setSucesso({
        chamadoId: res.chamado_id,
        protocolo: res.protocolo,
        referencia: res.referencia_tecnica,
      });
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      setErroSubmit(
        msg.includes("CHAMADOS_ACOES_INTEGRADAS_DESATIVADAS")
          ? "Esta funcionalidade está em piloto controlado e não está liberada para o seu usuário."
          : msg || "Não foi possível criar a solicitação.",
      );
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Sucesso ----------
  if (sucesso) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Solicitação criada com sucesso
          </CardTitle>
          <CardDescription>
            O chamado é o protocolo mestre e a solicitação é a referência técnica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Protocolo: </span>
            <strong>{sucesso.protocolo}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Referência: </span>
            <strong>{sucesso.referencia}</strong>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate(`/chamados-internos/${sucesso.chamadoId}`)}>
            Ver chamado
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/gestao-solicitacoes-equipamento")}
          >
            Ir para Solicitações
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Solicitação de Equipamento
          </CardTitle>
          <CardDescription>
            Registre a demanda, os itens e os dados operacionais. O chamado e a solicitação são
            criados juntos, em uma única operação.
          </CardDescription>
          <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs" aria-label="Progresso">
            {PASSOS.map((p, i) => {
              const ativo = passo === p.n;
              const feito = passo > p.n;
              return (
                <React.Fragment key={p.n}>
                  <li
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1",
                      ativo && "border-primary bg-primary/5 text-primary",
                      feito && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                      !ativo && !feito && "border-border text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        ativo && "bg-primary text-primary-foreground",
                        feito && "bg-emerald-500 text-white",
                        !ativo && !feito && "bg-muted text-foreground",
                      )}
                    >
                      {p.n}
                    </span>
                    {p.label}
                  </li>
                  {i < PASSOS.length - 1 && <span className="h-px w-6 bg-border" />}
                </React.Fragment>
              );
            })}
          </ol>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ---------------- ETAPA 1 ---------------- */}
          {passo === 1 && (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Centro de custo *</Label>
                  <Combobox
                    options={ccOptions}
                    value={centroCustoId}
                    onChange={(v) => {
                      setCentroCustoId(v);
                      setSolicitanteId("");
                    }}
                    placeholder={ccsQ.isLoading ? "Carregando..." : "Selecione um centro de custo"}
                    emptyText="Nenhum centro de custo disponível"
                    searchPlaceholder="Buscar por código ou nome..."
                    disabled={ccsQ.isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Solicitante *</Label>
                  <Combobox
                    options={solicitanteOptions}
                    value={solicitanteId}
                    onChange={setSolicitanteId}
                    placeholder={
                      !centroCustoId ? "Selecione um centro de custo primeiro" : "Selecione um funcionário"
                    }
                    emptyText="Nenhum funcionário localizado"
                    searchPlaceholder="Buscar por nome..."
                    disabled={!centroCustoId || solicitantesQ.isLoading}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="titulo-integrado">Título *</Label>
                  <Input
                    id="titulo-integrado"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    maxLength={160}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="descricao-integrada">Descrição *</Label>
                  <Textarea
                    id="descricao-integrada"
                    rows={4}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Descreva a necessidade operacional: frente de serviço, contexto e urgência."
                  />
                </div>
                <div className="md:col-span-2">
                  <ChamadoAnexosInput
                    inputId="anexos-solic-equip"
                    arquivos={anexos}
                    onChange={setAnexos}
                    disabled={enviando}
                  />
                </div>
              </section>

              <section className="space-y-3" data-testid="secao-itens">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Itens da solicitação</h3>
                  <Badge variant="outline" className="text-xs">
                    {itens.length} {itens.length === 1 ? "item" : "itens"}
                  </Badge>
                </div>

                {itens.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      Você ainda não adicionou nenhum item.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {itens.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                        data-testid="card-item-solicitacao"
                      >
                        <div className="text-sm font-semibold leading-tight">
                          {formatItemDisplay(item)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {item.tipo_item === "VEICULO" ? "Veículo" : "Equipamento"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Qtd: {item.quantidade}
                          </Badge>
                          {item.com_operador && (
                            <Badge variant="outline" className="text-xs">
                              Com operador
                            </Badge>
                          )}
                          {item.regime_trabalho && (
                            <Badge variant="outline" className="text-xs">
                              {REGIME_LABELS[item.regime_trabalho as RegimeTrabalho] ??
                                item.regime_trabalho}
                            </Badge>
                          )}
                          {isNaoCadastrado(item) && (
                            <Badge variant="destructive" className="text-xs">
                              Não cadastrado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditandoIndex(idx);
                              setEditorAberto(true);
                            }}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoverIndex(idx)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditandoIndex(null);
                    setEditorAberto(true);
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Adicionar item
                </Button>
              </section>

              {erroPasso1 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{erroPasso1}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* ---------------- ETAPA 2 ---------------- */}
          {passo === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Atendimento preferencial *</Label>
                <AtendimentoPreferencialSelect value={atendimento} onChange={setAtendimento} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-inicio-integrada">Data de início *</Label>
                <Input
                  id="data-inicio-integrada"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade *</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Engenheiro solicitante *</Label>
                <Combobox
                  options={engenheiroOptions}
                  value={engenheiroId}
                  onChange={setEngenheiroId}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar engenheiro..."
                  emptyText="Nenhum engenheiro encontrado"
                />
                <p className="text-xs text-muted-foreground">
                  Somente pessoas com usuário vinculado no sistema aparecem aqui.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Apontador (resp. campo) *</Label>
                <Combobox
                  options={apontadorOptions}
                  value={apontadorId}
                  onChange={setApontadorId}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar funcionário..."
                  emptyText="Nenhum encontrado"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="justificativa-integrada">Justificativa *</Label>
                <Textarea
                  id="justificativa-integrada"
                  rows={3}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Descreva a necessidade"
                />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                Regime de trabalho e tempo previsto são definidos por item, na etapa Solicitação.
              </p>
              {erroPasso2 && (
                <Alert variant="destructive" className="md:col-span-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{erroPasso2}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* ---------------- ETAPA 3 ---------------- */}
          {passo === 3 && (
            <div className="space-y-4">
              <dl className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
                <Revisao label="Centro de custo" valor={label(ccOptions, centroCustoId)} />
                <Revisao label="Solicitante" valor={label(solicitanteOptions, solicitanteId)} />
                <Revisao label="Título" valor={tituloTrim} span />
                <Revisao label="Descrição" valor={descricaoTrim} span pre />
                <Revisao
                  label="Anexos"
                  span
                  valor={
                    anexos.length === 0
                      ? "Nenhum arquivo anexado"
                      : `${anexos.length} ${anexos.length === 1 ? "arquivo anexado" : "arquivos anexados"}`
                  }
                />
              </dl>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">Itens ({itens.length})</h3>
                <div className="space-y-2">
                  {itens.map((item, idx) => (
                    <div key={idx} className="rounded-md border bg-background p-2 text-sm">
                      <div className="font-medium">
                        {item.quantidade} × {formatItemDisplay(item)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          item.tipo_item === "VEICULO" ? "Veículo" : "Equipamento",
                          item.com_operador ? "Com operador" : null,
                          item.regime_trabalho
                            ? REGIME_LABELS[item.regime_trabalho as RegimeTrabalho]
                            : null,
                          item.tempo_previsto_dias ? `${item.tempo_previsto_dias} dia(s)` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <dl className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
                <Revisao label="Atendimento preferencial" valor={atendimentoLabel} />
                <Revisao label="Data de início" valor={formatDateBR(dataInicio)} />
                <Revisao label="Prioridade" valor={PRIORIDADE_LABEL[prioridade] ?? prioridade} />
                <Revisao label="Engenheiro solicitante" valor={label(engenheiroOptions, engenheiroId)} />
                <Revisao label="Apontador" valor={label(apontadorOptions, apontadorId)} />
                <Revisao label="Justificativa" valor={justificativa.trim()} span pre />
              </dl>

              <div className="rounded-lg border p-4 text-sm">
                <h3 className="mb-2 text-sm font-semibold">Aprovação prevista</h3>
                {previewQ.isLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Consultando o motor de aprovação…
                  </span>
                ) : previewQ.data ? (
                  <dl className="grid gap-3 md:grid-cols-2">
                    <Revisao
                      label="Fluxo"
                      valor={previewQ.data.fluxo_nome ?? (previewQ.data.origem === "CORPORATIVO" ? "—" : "Fluxo legado de equipamentos")}
                    />
                    <Revisao
                      label="Primeira etapa"
                      valor={previewQ.data.primeira_etapa?.nome ?? "—"}
                    />
                    <Revisao
                      label="Aprovador previsto"
                      valor={previewQ.data.aprovador_previsto?.nome ?? (previewQ.data.resolvido ? "—" : "Não resolvido")}
                    />
                    {previewQ.data.erro ? <Revisao label="Observação" valor={previewQ.data.erro} /> : null}
                  </dl>
                ) : (
                  <span className="text-muted-foreground">
                    Previsão indisponível. A aprovação seguirá o comportamento definido pelo motor.
                  </span>
                )}
              </div>

              {erroSubmit && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{erroSubmit}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">Etapa {passo} de 3</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => (passo === 1 ? onVoltarCategoria() : setPasso((p) => (p === 3 ? 2 : 1)))}
              disabled={enviando}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            {passo === 1 && (
              <Button type="button" onClick={() => validarPasso1() && setPasso(2)}>
                Avançar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {passo === 2 && (
              <Button type="button" onClick={() => validarPasso2() && setPasso(3)}>
                Revisar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {passo === 3 && (
              <Button type="button" onClick={() => void handleEnviar()} disabled={enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar solicitação
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <ItemSolicitacaoEditorDialog
        open={editorAberto}
        editingItem={editandoIndex !== null ? itens[editandoIndex] : null}
        onClose={() => {
          setEditorAberto(false);
          setEditandoIndex(null);
        }}
        onSave={salvarItem}
      />

      <AlertDialog
        open={removerIndex !== null}
        onOpenChange={(o) => !o && setRemoverIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este item da solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              O item é removido apenas desta solicitação em preparo. Nada é gravado no banco antes
              do envio final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setItens((prev) => prev.filter((_, i) => i !== removerIndex));
                setRemoverIndex(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Revisao: React.FC<{ label: string; valor: string; span?: boolean; pre?: boolean }> = ({
  label,
  valor,
  span,
  pre,
}) => (
  <div className={cn(span && "md:col-span-2")}>
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={cn("mt-0.5 text-sm", pre && "whitespace-pre-wrap")}>{valor || "—"}</dd>
  </div>
);

export default SolicitacaoEquipamentoIntegradaWizard;
