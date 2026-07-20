/**
 * Seletor + ações do Carimbo do Relatório AP's.
 * Permission-first (relatorio_aplicacao_view: visualizar/criar/editar/excluir).
 * A CRIAÇÃO de novos carimbos foi movida para o botão "Novo carimbo" no cabeçalho da página.
 * Este componente cuida apenas de: seleção, aplicação, atualização (via modal),
 * definir/desvincular padrão, restaurar, limpar campos e inativar.
 */
import React from "react";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import {
  useCarimboPadrao,
  useCarimbosLista,
  useDefinirPadrao,
  useDesvincularPadrao,
  useInativarCarimbo,
} from "@/hooks/relatorio-aps/useRelatorioApsCarimbos";
import RelatorioApsCarimboDialog from "./RelatorioApsCarimboDialog";
import {
  mensagemAmigavel,
  type RelatorioApsCarimboError,
  type RelatorioApsCarimboRow,
} from "@/types/relatorioApsCarimbo";
import type { CarimboAtualMeta } from "@/hooks/relatorio-aps/useRelatorioApsState";

interface CentroCustoOpt {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo: string;
}

interface Cabecalho7 {
  obra: string;
  empresa: string;
  cliente: string;
  rua: string;
  bairro: string;
  revisao: string;
  observacoes: string;
}

interface Props {
  centroCustoId: string | null;
  centrosCusto: CentroCustoOpt[];
  cabecalho: Cabecalho7;
  carimboAtual: CarimboAtualMeta | null;
  isDirty: boolean;
  onAplicar: (row: RelatorioApsCarimboRow) => void;
  onLimparSelecao: () => void;
  onLimparCabecalho: () => void;
  onRestaurar: () => void;
  onSnapshotAtualizado: (row: RelatorioApsCarimboRow) => void;
}

const RelatorioApsCarimboSelector: React.FC<Props> = ({
  centroCustoId,
  centrosCusto,
  cabecalho,
  carimboAtual,
  isDirty,
  onAplicar,
  onLimparSelecao,
  onLimparCabecalho,
  onRestaurar,
  onSnapshotAtualizado,
}) => {
  const { hasActionPermission, isLoading: permLoading } = usePermission();
  const podeVer = permLoading || hasActionPermission("relatorio_aplicacao_view", "visualizar");
  const podeEditar = hasActionPermission("relatorio_aplicacao_view", "editar");
  const podeExcluir = hasActionPermission("relatorio_aplicacao_view", "excluir");

  const lista = useCarimbosLista(centroCustoId);
  const padrao = useCarimboPadrao(centroCustoId);
  const definir = useDefinirPadrao();
  const desvincular = useDesvincularPadrao();
  const inativar = useInativarCarimbo(centroCustoId);

  const [editOpen, setEditOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<
    | null
    | {
        titulo: string;
        descricao: string;
        onConfirm: () => void | Promise<void>;
        destrutivo?: boolean;
      }
  >(null);

  const opcoes: ComboboxOption[] = React.useMemo(() => {
    const rows = lista.data ?? [];
    return rows.map((r) => {
      const geral = r.centro_custo_id == null;
      const padraoDoCc =
        !geral && !!centroCustoId && r.padrao_centro_custo && r.centro_custo_id === centroCustoId;
      const suffix = padraoDoCc ? " • Padrão" : geral ? " • Geral" : "";
      return {
        value: r.id,
        label: `${r.nome}${suffix}`,
        searchText: `${r.nome}`,
      };
    });
  }, [lista.data, centroCustoId]);

  const handleAplicarPorId = (id: string) => {
    const row = (lista.data ?? []).find((r) => r.id === id);
    if (row) onAplicar(row);
  };

  const salvando =
    definir.isPending || desvincular.isPending || inativar.isPending;

  const acaoDefinirPadrao = () => {
    if (!carimboAtual || !centroCustoId || !podeEditar) return;
    const geral = carimboAtual.centro_custo_id == null;
    const outroCc =
      carimboAtual.centro_custo_id && carimboAtual.centro_custo_id !== centroCustoId;
    if (outroCc) {
      toast.warning(mensagemAmigavel("CARIMBO_ASSOCIADO_OUTRO_CC"));
      return;
    }
    const executar = async () => {
      try {
        const row = await definir.mutateAsync({
          carimboId: carimboAtual.id,
          centroCustoId,
        });
        onAplicar(row);
        toast.success("Carimbo definido como padrão do Centro de Custo.");
      } catch (err) {
        const e = err as RelatorioApsCarimboError;
        toast.error(e.message || mensagemAmigavel(e.code ?? "CARIMBO_ERRO_DESCONHECIDO"));
      }
    };
    if (geral) {
      setConfirm({
        titulo: "Associar carimbo geral ao Centro de Custo?",
        descricao:
          "Este carimbo deixará de ser geral e ficará associado ao Centro de Custo selecionado.",
        onConfirm: executar,
      });
    } else {
      void executar();
    }
  };

  const acaoDesvincular = async () => {
    if (!centroCustoId || !podeEditar) return;
    try {
      const row = await desvincular.mutateAsync(centroCustoId);
      if (row && carimboAtual && row.id === carimboAtual.id) {
        onSnapshotAtualizado(row);
      }
      toast.success("Padrão do Centro de Custo desvinculado.");
    } catch (err) {
      const e = err as RelatorioApsCarimboError;
      toast.error(e.message || mensagemAmigavel(e.code ?? "CARIMBO_ERRO_DESCONHECIDO"));
    }
  };

  const acaoInativar = () => {
    if (!carimboAtual || !podeExcluir) return;
    setConfirm({
      titulo: "Inativar este carimbo?",
      descricao:
        "O carimbo será removido da lista de disponíveis. Os dados atuais do relatório permanecerão.",
      destrutivo: true,
      onConfirm: async () => {
        try {
          await inativar.mutateAsync({
            carimboId: carimboAtual.id,
            updatedAtEsperado: carimboAtual.updated_at,
          });
          onLimparSelecao();
          toast.success("Carimbo inativado.");
        } catch (err) {
          const e = err as RelatorioApsCarimboError;
          toast.error(e.message || mensagemAmigavel(e.code ?? "CARIMBO_ERRO_DESCONHECIDO"));
        }
      },
    });
  };

  const geral = carimboAtual?.centro_custo_id == null;
  const isPadraoAqui =
    !!carimboAtual &&
    !!centroCustoId &&
    carimboAtual.padrao_centro_custo &&
    carimboAtual.centro_custo_id === centroCustoId;

  if (!podeVer) return null;

  const listaVazia = !lista.isLoading && (lista.data ?? []).length === 0;

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Stamp className="h-4 w-4 text-primary shrink-0" />
        <div className="text-xs font-semibold whitespace-nowrap">Carimbo:</div>
        <div className="min-w-0 flex-1 max-w-md">
          <Combobox
            options={opcoes}
            value={carimboAtual?.id ?? ""}
            onChange={handleAplicarPorId}
            placeholder={
              lista.isLoading
                ? "Carregando..."
                : listaVazia
                  ? "Nenhum carimbo cadastrado"
                  : "Selecione um carimbo"
            }
            emptyText={
              lista.isLoading ? "Carregando..." : "Nenhum carimbo cadastrado"
            }
            searchPlaceholder="Buscar carimbo..."
          />
          {listaVazia && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use o botão <span className="font-medium">Novo carimbo</span> para
              cadastrar o primeiro.
            </p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-1">
          {carimboAtual && geral && (
            <Badge variant="secondary" className="text-[10px]">Geral</Badge>
          )}
          {isPadraoAqui && (
            <Badge variant="default" className="text-[10px]">Padrão</Badge>
          )}
          {padrao.data && !carimboAtual && (
            <Badge variant="outline" className="text-[10px]">Padrão: {padrao.data.nome}</Badge>
          )}
          {isDirty && (
            <Badge variant="destructive" className="text-[10px]">
              Não salvo
            </Badge>
          )}
          {(lista.isFetching || salvando) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {podeEditar && carimboAtual && (
          <Button
            size="sm"
            variant="default"
            onClick={() => setEditOpen(true)}
            disabled={salvando}
            title="Atualizar carimbo"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Atualizar carimbo
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              disabled={!carimboAtual || !centroCustoId || !podeEditar || isPadraoAqui}
              onClick={acaoDefinirPadrao}
            >
              <Pin className="h-4 w-4 mr-2" />
              Definir como padrão
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!centroCustoId || !podeEditar || !padrao.data}
              onClick={acaoDesvincular}
            >
              <PinOff className="h-4 w-4 mr-2" />
              Desvincular padrão
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!carimboAtual} onClick={onRestaurar}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar carimbo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLimparCabecalho}>
              <X className="h-4 w-4 mr-2" />
              Limpar campos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={!carimboAtual || !podeExcluir}
              onClick={acaoInativar}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Inativar carimbo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {carimboAtual && (
        <RelatorioApsCarimboDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="editar"
          edicao={{
            id: carimboAtual.id,
            updated_at: carimboAtual.updated_at,
            centro_custo_id: carimboAtual.centro_custo_id,
            padrao_centro_custo: carimboAtual.padrao_centro_custo,
          }}
          centroCustoId={centroCustoId}
          centrosCusto={centrosCusto}
          initial={{
            nome: carimboAtual.nome,
            obra: cabecalho.obra,
            empresa: cabecalho.empresa,
            cliente: cabecalho.cliente,
            bairro: cabecalho.bairro,
            revisao: cabecalho.revisao,
            observacoes: cabecalho.observacoes,
          }}
          podeEditarPadrao={podeEditar}
          onSalvo={(row) => onAplicar(row)}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.descricao}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.destrutivo ? "bg-destructive hover:bg-destructive/90" : undefined}
              onClick={async () => {
                const acao = confirm?.onConfirm;
                setConfirm(null);
                if (acao) await acao();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RelatorioApsCarimboSelector;
