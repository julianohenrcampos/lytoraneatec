/**
 * CT-5 — Etapa "Caminhões e motoristas" da puxada.
 *
 * N caminhões × 1 motorista cada. O catálogo de caminhões é o do CT-4 e os
 * motoristas vêm da RPC autoritativa `fn_motoristas_operacional_lookup`
 * (SECURITY DEFINER — funciona também para o papel Apontador).
 */
import React, { useMemo } from "react";
import { AlertTriangle, Trash2, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useCtMotoristasOperacionais } from "@/hooks/central-transporte/useCtPuxada";
import { caminhaoRascunho } from "@/lib/central-transporte/puxadaRascunho";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
} from "@/types/centralTransporteMovDireta";
import type { CtPuxadaCaminhaoRascunho } from "@/types/centralTransportePuxada";
import CatalogoCaminhaoPuxada from "./CatalogoCaminhaoPuxada";

interface Props {
  caminhoes: CtPuxadaCaminhaoRascunho[];
  somenteLeitura: boolean;
  onChange: (caminhoes: CtPuxadaCaminhaoRascunho[]) => void;
}

const CaminhoesPuxadaEditor: React.FC<Props> = ({ caminhoes, somenteLeitura, onChange }) => {
  const { motoristas, isLoading, error } = useCtMotoristasOperacionais();

  const opcoesMotorista: ComboboxOption[] = useMemo(
    () =>
      motoristas.map((m) => ({
        value: m.id,
        label: m.funcaoNome ? `${m.nomeCompleto} — ${m.funcaoNome}` : m.nomeCompleto,
        searchText: [m.nomeCompleto, m.matricula, m.funcaoNome].filter(Boolean).join(" "),
      })),
    [motoristas],
  );

  const jaEscolhidos = useMemo(
    () => new Set(caminhoes.map((c) => c.caminhaoEquipamentoId)),
    [caminhoes],
  );

  const adicionar = (a: CtAtivoMovimentacao) =>
    onChange([
      ...caminhoes,
      caminhaoRascunho({
        caminhaoEquipamentoId: a.equipamentoId,
        rotulo: rotuloAtivoMovimentacao(a),
        placa: a.placa,
      }),
    ]);

  const remover = (chave: string) =>
    onChange(caminhoes.filter((c) => c.chaveLocal !== chave));

  const definirMotorista = (chave: string, motoristaId: string) => {
    const nome = motoristas.find((m) => m.id === motoristaId)?.nomeCompleto ?? "";
    onChange(
      caminhoes.map((c) =>
        c.chaveLocal === chave
          ? { ...c, motoristaFuncionarioId: motoristaId || null, motoristaNome: nome }
          : c,
      ),
    );
  };

  return (
    <div className="space-y-3" data-testid="ct5-caminhoes-editor">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Cada caminhão da puxada precisa de um motorista. A disponibilidade é revalidada pelo
          servidor no momento de programar.
        </p>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {caminhoes.length} caminhão(ões)
        </Badge>
      </div>

      {!somenteLeitura && (
        <CatalogoCaminhaoPuxada
          jaEscolhidos={jaEscolhidos}
          desabilitado={somenteLeitura}
          onSelecionar={adicionar}
        />
      )}

      {error && (
        <Alert variant="destructive" data-testid="ct5-motoristas-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Não foi possível carregar os motoristas</AlertTitle>
          <AlertDescription className="text-xs">
            Isto é um erro técnico da consulta (não significa “nenhum motorista”). Tente
            novamente antes de programar a puxada.
          </AlertDescription>
        </Alert>
      )}

      {caminhoes.length === 0 ? (
        <p
          className="rounded-md border border-dashed p-4 text-center text-[11px] text-muted-foreground"
          data-testid="ct5-caminhoes-vazio"
        >
          Nenhum caminhão nesta puxada. Use “Adicionar caminhão”.
        </p>
      ) : (
        <div className="space-y-2">
          {caminhoes.map((c) => (
            <div
              key={c.chaveLocal}
              className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end"
              data-testid={`ct5-caminhao-${c.caminhaoEquipamentoId}`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-xs font-medium">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  {c.rotulo}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.placa || "Sem placa cadastrada"}
                </p>
              </div>

              <div className="min-w-0 space-y-1">
                <Label className="text-[11px]">Motorista *</Label>
                <Combobox
                  disabled={somenteLeitura || isLoading}
                  value={c.motoristaFuncionarioId ?? ""}
                  options={opcoesMotorista}
                  placeholder={isLoading ? "Carregando..." : "Selecione o motorista"}
                  searchPlaceholder="Buscar motorista..."
                  onChange={(v) => definirMotorista(c.chaveLocal, v)}
                />
              </div>

              {!somenteLeitura && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                  aria-label={`Remover caminhão ${c.rotulo}`}
                  onClick={() => remover(c.chaveLocal)}
                  data-testid={`ct5-remover-caminhao-${c.caminhaoEquipamentoId}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaminhoesPuxadaEditor;
