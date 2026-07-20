/**
 * Modal "Novo carimbo do relatório" / "Atualizar carimbo".
 * Persiste 6 campos administrativos + operacionais do card "Dados do Relatório",
 * mais nome + associação opcional a Centro de Custo.
 * A Rua NÃO é persistida no carimbo — ela é dinâmica e vem do filtro
 * "Rua / Logradouro" da tela.
 */
import React from "react";
import { Loader2, Eraser } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import {
  useAtualizarCarimbo,
  useCriarCarimbo,
} from "@/hooks/relatorio-aps/useRelatorioApsCarimbos";
import {
  mensagemAmigavel,
  type RelatorioApsCarimboError,
  type RelatorioApsCarimboRow,
} from "@/types/relatorioApsCarimbo";

interface CentroCustoOpt {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo: string;
}

export interface CarimboDialogInitial {
  nome?: string;
  obra?: string;
  empresa?: string;
  cliente?: string;
  bairro?: string;
  revisao?: string;
  observacoes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** "criar" (default) ou "editar". */
  mode?: "criar" | "editar";
  /** Em modo editar: id + updated_at + centro_custo_id + padrao. */
  edicao?: {
    id: string;
    updated_at: string;
    centro_custo_id: string | null;
    padrao_centro_custo: boolean;
  } | null;
  /** Centro de custo atualmente selecionado na página. */
  centroCustoId: string | null;
  centrosCusto: CentroCustoOpt[];
  /** Sugestões iniciais para os campos. */
  initial: CarimboDialogInitial;
  podeEditarPadrao: boolean;
  onSalvo: (row: RelatorioApsCarimboRow) => void;
}

const schema = z.object({
  nome: z.string().trim().min(1, "Informe um nome").max(120),
  obra: z.string().max(200),
  empresa: z.string().max(200),
  cliente: z.string().max(200),
  bairro: z.string().max(120),
  revisao: z.string().trim().min(1, "Revisão obrigatória").max(10),
  observacoes: z.string().max(5000),
});

const vazioInit = (init: CarimboDialogInitial) => ({
  nome: init.nome ?? "",
  obra: init.obra ?? "",
  empresa: init.empresa ?? "",
  cliente: init.cliente ?? "",
  bairro: init.bairro ?? "",
  revisao: init.revisao?.trim() ? init.revisao : "00",
  observacoes: init.observacoes ?? "",
});

const RelatorioApsCarimboDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  mode = "criar",
  edicao,
  centroCustoId,
  centrosCusto,
  initial,
  podeEditarPadrao,
  onSalvo,
}) => {
  const isEditar = mode === "editar" && !!edicao;
  const [form, setForm] = React.useState(() => vazioInit(initial));
  const [ccSelecionado, setCcSelecionado] = React.useState<string>(
    isEditar ? (edicao?.centro_custo_id ?? "") : (centroCustoId ?? ""),
  );
  const [definirPadrao, setDefinirPadrao] = React.useState<boolean>(false);

  const criar = useCriarCarimbo(centroCustoId);
  const atualizar = useAtualizarCarimbo(centroCustoId);

  // Reinicia estado sempre que abrir
  React.useEffect(() => {
    if (!open) return;
    setForm(vazioInit(initial));
    setCcSelecionado(
      isEditar ? (edicao?.centro_custo_id ?? "") : (centroCustoId ?? ""),
    );
    setDefinirPadrao(false);
  }, [open, initial, centroCustoId, isEditar, edicao?.centro_custo_id]);

  const ccOptions: ComboboxOption[] = React.useMemo(
    () =>
      centrosCusto.map((c) => ({
        value: c.id,
        label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}`,
        searchText: `${c.codigo_centro_custo} ${c.nome_centro_custo}`,
      })),
    [centrosCusto],
  );

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const limparFormulario = () => {
    setForm({
      nome: form.nome, // preserva nome digitado
      obra: "",
      empresa: "",
      cliente: "",
      bairro: "",
      revisao: "00",
      observacoes: "",
    });
  };

  const salvando = criar.isPending || atualizar.isPending;

  const salvar = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulário inválido.");
      return;
    }
    const payload = parsed.data;
    try {
      let row: RelatorioApsCarimboRow;
      if (isEditar && edicao) {
        row = await atualizar.mutateAsync({
          carimboId: edicao.id,
          updatedAtEsperado: edicao.updated_at,
          nome: payload.nome,
          obra: payload.obra,
          empresa: payload.empresa,
          cliente: payload.cliente,
          bairro: payload.bairro,
          revisao: payload.revisao || "00",
          observacoes: payload.observacoes,
        });
        toast.success("Carimbo atualizado com sucesso.");
      } else {
        const ccId = ccSelecionado || null;
        row = await criar.mutateAsync({
          nome: payload.nome,
          centroCustoId: ccId,
          obra: payload.obra,
          empresa: payload.empresa,
          cliente: payload.cliente,
          bairro: payload.bairro,
          revisao: payload.revisao || "00",
          observacoes: payload.observacoes,
          definirPadrao: !!ccId && definirPadrao && podeEditarPadrao,
        });
        toast.success("Carimbo criado com sucesso.");
      }
      onSalvo(row);
      onOpenChange(false);
    } catch (err) {
      const e = err as RelatorioApsCarimboError;
      toast.error(e.message || mensagemAmigavel(e.code ?? "CARIMBO_ERRO_DESCONHECIDO"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditar ? "Atualizar carimbo" : "Novo carimbo do relatório"}
          </DialogTitle>
          <DialogDescription>
            {isEditar
              ? "Edite os dados salvos deste carimbo."
              : "Cadastre os dados que poderão ser reutilizados nos Relatórios de Aplicação Diária. A Rua é dinâmica e vem do filtro da tela."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="carimbo-nome">Nome do carimbo *</Label>
              <Input
                id="carimbo-nome"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex.: Recapeamento — Prefeitura"
                maxLength={120}
                autoFocus
              />
            </div>

            {!isEditar && (
              <div className="grid grid-cols-1 gap-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label>Centro de Custo (opcional)</Label>
                  <Combobox
                    options={ccOptions}
                    value={ccSelecionado}
                    onChange={setCcSelecionado}
                    placeholder="Carimbo geral (sem CC)"
                    emptyText="Nenhum CC encontrado"
                    searchPlaceholder="Buscar CC..."
                  />
                  {ccSelecionado && (
                    <button
                      type="button"
                      onClick={() => setCcSelecionado("")}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Salvar como carimbo geral (remover CC)
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="carimbo-padrao"
                    checked={!!ccSelecionado && definirPadrao}
                    disabled={!ccSelecionado || !podeEditarPadrao}
                    onCheckedChange={(v) => setDefinirPadrao(!!v)}
                  />
                  <Label
                    htmlFor="carimbo-padrao"
                    className={
                      !ccSelecionado || !podeEditarPadrao
                        ? "text-muted-foreground"
                        : undefined
                    }
                  >
                    Definir como padrão deste Centro de Custo
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Dados do Relatório */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Dados do relatório
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-obra">Obra</Label>
              <Input
                id="c-obra"
                value={form.obra}
                onChange={(e) => setField("obra", e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-empresa">Empresa</Label>
                <Input
                  id="c-empresa"
                  value={form.empresa}
                  onChange={(e) => setField("empresa", e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-cliente">Cliente</Label>
                <Input
                  id="c-cliente"
                  value={form.cliente}
                  onChange={(e) => setField("cliente", e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-bairro">Bairro</Label>
                <Input
                  id="c-bairro"
                  value={form.bairro}
                  onChange={(e) => setField("bairro", e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-revisao">Revisão *</Label>
                <Input
                  id="c-revisao"
                  value={form.revisao}
                  onChange={(e) => setField("revisao", e.target.value)}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-obs">Observações</Label>
              <Textarea
                id="c-obs"
                value={form.observacoes}
                onChange={(e) => setField("observacoes", e.target.value)}
                maxLength={5000}
                rows={4}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limparFormulario}
            disabled={salvando}
            className="text-muted-foreground"
          >
            <Eraser className="mr-2 h-4 w-4" />
            Limpar formulário
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditar ? "Salvar alterações" : "Criar carimbo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RelatorioApsCarimboDialog;
