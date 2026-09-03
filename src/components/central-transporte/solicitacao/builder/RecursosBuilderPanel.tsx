/**
 * CT-6 — Coluna direita do Transport Builder: MOTORISTAS e VEÍCULOS
 * TRANSPORTADORES como recursos arrastáveis.
 *
 * Fonte de dados: exatamente `useCtMobilizacaoCadastros` (leitura sob RLS).
 * Os tons refletem estado REAL derivado do rascunho — não existe motor de
 * disponibilidade de motorista neste módulo e nada é inventado aqui.
 */
import React, { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Truck, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  dragId,
  type CtDragTipo,
  type CtRecursoEstado,
} from "@/lib/central-transporte/transportBuilder";

const PONTO: Record<CtRecursoEstado, string> = {
  LIVRE: "bg-emerald-600",
  EM_USO: "bg-amber-500",
  CONFLITO: "bg-destructive",
};

const ESTADO_LABEL: Record<CtRecursoEstado, string> = {
  LIVRE: "Sem uso neste planejamento",
  EM_USO: "Já usado neste planejamento",
  CONFLITO: "Conflito neste planejamento",
};

interface ItemProps {
  tipo: CtDragTipo;
  opcao: ComboboxOption;
  estado: CtRecursoEstado;
  desabilitado: boolean;
  testId: string;
  acoes: { rotulo: string; onSelect: () => void }[];
}

const RecursoItem: React.FC<ItemProps> = ({
  tipo,
  opcao,
  estado,
  desabilitado,
  testId,
  acoes,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(tipo, opcao.value),
    disabled: desabilitado,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={testId}
      data-estado={estado}
      title={`${opcao.label} — ${ESTADO_LABEL[estado]}`}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px]",
        isDragging && "opacity-50 shadow-lg",
        desabilitado && "opacity-60",
      )}
    >
      {!desabilitado && (
        <button
          type="button"
          aria-label={`Arrastar ${opcao.label}`}
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <span className={cn("h-2 w-2 shrink-0 rounded-full", PONTO[estado])} aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="min-w-0 flex-1 truncate text-left">
            {opcao.label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-xs">
          <DropdownMenuLabel className="text-[10px]">{opcao.label}</DropdownMenuLabel>
          {acoes.length === 0 ? (
            <DropdownMenuItem disabled>Nenhuma viagem em edição</DropdownMenuItem>
          ) : (
            acoes.map((a) => (
              <DropdownMenuItem key={a.rotulo} onSelect={() => a.onSelect()}>
                {a.rotulo}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export interface RecursosBuilderPanelProps {
  motoristas: ComboboxOption[];
  veiculos: ComboboxOption[];
  /** Funcionários ativos do CC DESTINO (recebedores previstos). */
  recebedores: ComboboxOption[];
  /** Código/rótulo do CC destino, apenas para o título da seção. */
  recebedoresCcRotulo: string | null;
  recebedoresCarregando?: boolean;
  desabilitado?: boolean;
  estadoMotorista: (id: string) => CtRecursoEstado;
  estadoVeiculo: (id: string) => CtRecursoEstado;
  /** Viagens em edição, para os fallbacks "Aplicar à viagem…". */
  viagens: { chaveLocal: string; rotulo: string }[];
  onAplicarMotorista: (chaveLocal: string, motoristaId: string) => void;
  onAplicarVeiculo: (chaveLocal: string, veiculoId: string) => void;
  onAplicarRecebedor: (chaveLocal: string, funcionarioId: string) => void;
  onNovaViagemComVeiculo: (veiculoId: string) => void;
}

export const RecursosBuilderPanel: React.FC<RecursosBuilderPanelProps> = ({
  motoristas,
  veiculos,
  recebedores,
  recebedoresCcRotulo,
  recebedoresCarregando = false,
  desabilitado = false,
  estadoMotorista,
  estadoVeiculo,
  viagens,
  onAplicarMotorista,
  onAplicarVeiculo,
  onAplicarRecebedor,
  onNovaViagemComVeiculo,
}) => {
  const [buscaM, setBuscaM] = useState("");
  const [buscaR, setBuscaR] = useState("");
  const [buscaV, setBuscaV] = useState("");

  const filtrar = (opcoes: ComboboxOption[], termo: string) =>
    opcoes
      .filter((o) =>
        termo.trim() === ""
          ? true
          : `${o.label} ${o.searchText ?? ""}`.toLowerCase().includes(termo.toLowerCase()),
      )
      .slice(0, 40);

  const listaM = useMemo(() => filtrar(motoristas, buscaM), [motoristas, buscaM]);
  const listaR = useMemo(() => filtrar(recebedores, buscaR), [recebedores, buscaR]);
  const listaV = useMemo(() => filtrar(veiculos, buscaV), [veiculos, buscaV]);


  return (
    <Card
      className="flex h-full min-h-0 flex-col overflow-hidden xl:sticky xl:top-4"
      data-testid="ct6-coluna-recursos"
    >
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide">Recursos do transporte</p>
        <section className="space-y-1.5" data-testid="ct6-motoristas">

          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Motoristas
            <span className="ml-auto normal-case">{motoristas.length}</span>
          </p>
          <Input
            value={buscaM}
            onChange={(e) => setBuscaM(e.target.value)}
            placeholder="Buscar motorista..."
            data-testid="ct6-motoristas-busca"
            className="h-7 text-xs"
          />
          <div
            className="grid max-h-[160px] gap-0.5 overflow-y-auto pr-1"
            data-testid="ct6-motoristas-scroll"
          >
            {listaM.map((o) => (
              <RecursoItem
                key={o.value}
                tipo="MOTORISTA"
                opcao={o}
                estado={estadoMotorista(o.value)}
                desabilitado={desabilitado}
                testId={`ct6-motorista-${o.value}`}
                acoes={viagens.map((v) => ({
                  rotulo: `Aplicar à ${v.rotulo}`,
                  onSelect: () => onAplicarMotorista(v.chaveLocal, o.value),
                }))}
              />
            ))}
            {listaM.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nenhum motorista para a busca.</p>
            )}
          </div>
        </section>

        {/* RECEBEDORES — funcionários ativos do CC destino da viagem */}
        <section className="space-y-1.5" data-testid="ct6-recebedores">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Recebedores
            {recebedoresCcRotulo ? ` — ${recebedoresCcRotulo}` : ""}
            <span className="ml-auto normal-case">{recebedores.length}</span>
          </p>
          <Input
            value={buscaR}
            onChange={(e) => setBuscaR(e.target.value)}
            placeholder="Buscar recebedor..."
            data-testid="ct6-recebedores-busca"
            className="h-7 text-xs"
          />
          <div
            className="grid max-h-[120px] gap-0.5 overflow-y-auto pr-1"
            data-testid="ct6-recebedores-scroll"
          >
            {listaR.map((o) => (
              <RecursoItem
                key={o.value}
                tipo="RECEBEDOR"
                opcao={o}
                estado="LIVRE"
                desabilitado={desabilitado}
                testId={`ct6-recebedor-${o.value}`}
                acoes={viagens.map((v) => ({
                  rotulo: `Aplicar à ${v.rotulo}`,
                  onSelect: () => onAplicarRecebedor(v.chaveLocal, o.value),
                }))}
              />
            ))}
            {listaR.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                {recebedoresCarregando
                  ? "Carregando funcionários do destino..."
                  : "Nenhum funcionário ativo no centro de custo destino."}
              </p>
            )}
          </div>
        </section>



        <section className="space-y-2" data-testid="ct6-transportadores">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Truck className="h-3.5 w-3.5" /> Veículos transportadores
            <span className="ml-auto normal-case">{veiculos.length}</span>
          </p>
          <Input
            value={buscaV}
            onChange={(e) => setBuscaV(e.target.value)}
            placeholder="Buscar transportador..."
            className="h-7 text-xs"
          />
          <div
            className="grid max-h-[200px] gap-0.5 overflow-y-auto pr-1"
            data-testid="ct6-transportadores-scroll"
          >
            {listaV.map((o) => (
              <RecursoItem
                key={o.value}
                tipo="VEICULO"
                opcao={o}
                estado={estadoVeiculo(o.value)}
                desabilitado={desabilitado}
                testId={`ct6-veiculo-${o.value}`}
                acoes={[
                  {
                    rotulo: "Usar em nova viagem",
                    onSelect: () => onNovaViagemComVeiculo(o.value),
                  },
                  ...viagens.map((v) => ({
                    rotulo: `Aplicar à ${v.rotulo}`,
                    onSelect: () => onAplicarVeiculo(v.chaveLocal, o.value),
                  })),
                ]}
              />
            ))}
            {listaV.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Nenhum transportador para a busca.
              </p>
            )}
          </div>
        </section>

        <p className="text-[10px] text-muted-foreground">
          Arraste sobre um card de viagem — ou clique no recurso para aplicar sem arrastar.
        </p>
      </CardContent>
    </Card>
  );
};

export default RecursosBuilderPanel;
