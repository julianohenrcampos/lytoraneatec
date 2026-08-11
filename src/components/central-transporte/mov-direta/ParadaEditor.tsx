/**
 * CT-4 UX — Formulário da parada selecionada (uma por vez).
 *
 * Fluxo unidirecional em seções numeradas (o que → quando → para onde →
 * quem recebe → observações), reaproveitando `PontoOperacionalBloco` para
 * endereço/mapa. Só apresentação: elegibilidade vem do servidor e a
 * duplicidade entre paradas usa a regra já existente do rascunho.
 */
import React from "react";
import { MapPin, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { Textarea } from "@/components/ui/textarea";
import PontoOperacionalBloco from "@/components/central-transporte/shared/PontoOperacionalBloco";

import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
  type CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";

interface Props {
  parada: CtParadaRascunho;
  ordem: number;
  centrosCusto: ComboboxOption[];
  enderecosCentroCusto: Record<string, string | null>;
  funcionarios: ComboboxOption[];
  /** SOMENTE os ativos participantes da movimentação atual (nunca o catálogo). */
  ativos: CtAtivoMovimentacao[];
  /** Equipamentos já alocados em outras paradas desta viagem. */
  bloqueados: Set<string>;
  /** Onde cada equipamento já está alocado (para explicar o bloqueio). */
  alocacoes?: Map<string, { indice: number; rotulo: string }>;
  podeRemover: boolean;
  desabilitado: boolean;
  onChange: (patch: Partial<CtParadaRascunho>) => void;
  onRemover: () => void;
}

const ParadaEditor: React.FC<Props> = ({
  parada,
  ordem,
  centrosCusto,
  enderecosCentroCusto,
  funcionarios,
  ativos,
  bloqueados,
  alocacoes,
  podeRemover,
  desabilitado,
  onChange,
  onRemover,
}) => {
  const porId = new Map(ativos.map((a) => [a.equipamentoId, a]));
  const [externo, setExterno] = React.useState(parada.recebedorPrevistoNome.trim().length > 0);

  /* Opções = ativos DA MOVIMENTAÇÃO ainda não atribuídos a outra parada
     (mais os já desta parada). O catálogo geral nunca aparece aqui. */
  const opcoesAtivos = ativos
    .filter((a) => !bloqueados.has(a.equipamentoId))
    .map((a) => ({
      value: a.equipamentoId,
      label: [
        rotuloAtivoMovimentacao(a),
        a.placa,
        a.centroCustoLabel ? `· ${a.centroCustoLabel}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    }));

  const bloqueadosDetalhados = Array.from(bloqueados)
    .map((id) => ({ id, ativo: porId.get(id), alocacao: alocacoes?.get(id) }))
    .filter((x) => !!x.ativo && !!x.alocacao);

  const textoVazio =
    ativos.length === 0
      ? "Nenhum ativo planejado nesta movimentação — use “+ Planejar ativo” no painel à esquerda."
      : "Nenhum ativo disponível — todos os ativos da movimentação já estão em outras paradas.";


  return (
    <Card data-testid={`ct4-parada-editor-${ordem}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          {ordem}ª parada (entrega)
        </CardTitle>
        <div className="flex items-center gap-2">
          {podeRemover && !desabilitado && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={onRemover}
              data-testid={`ct4-remover-parada-${ordem}`}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-4">
        {/* Ativos desta parada */}
        <div className="space-y-2" data-testid={`ct4-ativos-parada-${ordem}`}>
          <div className="flex items-center gap-2">
            <Label className="text-[11px]">Ativos desta parada</Label>
            <Badge variant="outline" className="text-[10px]">
              {parada.equipamentos.length}
            </Badge>
          </div>

          {!desabilitado && (
            <MultiCombobox
              options={opcoesAtivos}
              value={parada.equipamentos}
              placeholder="Selecione os ativos..."
              emptyText={textoVazio}
              onChange={(v) => onChange({ equipamentos: v })}
            />
          )}

          {!desabilitado && opcoesAtivos.length === 0 && (
            <p
              className="text-[11px] text-muted-foreground"
              data-testid={`ct4-ativos-parada-vazio-${ordem}`}
            >
              {textoVazio}
            </p>
          )}


          {parada.equipamentos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parada.equipamentos.map((id) => {
                const a = porId.get(id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px]"
                    data-testid={`ct4-chip-ativo-${id}`}
                  >
                    {a ? rotuloAtivoMovimentacao(a) : id.slice(0, 8)}
                    {!desabilitado && (
                      <button
                        type="button"
                        aria-label="Remover ativo da parada"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          onChange({
                            equipamentos: parada.equipamentos.filter((x) => x !== id),
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {bloqueadosDetalhados.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {bloqueadosDetalhados.map((b) => (
                <li key={b.id}>
                  {rotuloAtivoMovimentacao(b.ativo!)} — alocado à Parada {b.alocacao!.indice + 1} —{" "}
                  {b.alocacao!.rotulo}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Data / hora */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Data prevista</Label>
            <Input
              type="date"
              value={parada.dataPrevista}
              disabled={desabilitado}
              onChange={(e) => onChange({ dataPrevista: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Hora prevista</Label>
            <Input
              type="time"
              value={parada.horaPrevista}
              disabled={desabilitado}
              onChange={(e) => onChange({ horaPrevista: e.target.value })}
            />
          </div>
        </div>

        {/* Destino */}
        <PontoOperacionalBloco
          semMoldura
          titulo="Destino — entrega"
          labelCentroCusto="Centro de custo / obra"
          placeholderCentroCusto="Selecione a obra da entrega"
          labelPonto="Ponto exato de entrega"
          centrosCusto={centrosCusto}
          centroCustoId={parada.centroCustoId}
          centroCustoEndereco={
            parada.centroCustoId ? enderecosCentroCusto[parada.centroCustoId] ?? null : null
          }
          ponto={parada.pontoExato}
          latitude={parada.latitude}
          longitude={parada.longitude}
          somenteLeitura={desabilitado}
          testId={`ct4-destino-${ordem}`}
          onChange={(patch) =>
            onChange({
              ...(patch.centroCustoId !== undefined
                ? {
                    centroCustoId: patch.centroCustoId,
                    endereco:
                      parada.endereco ||
                      (patch.centroCustoId
                        ? enderecosCentroCusto[patch.centroCustoId] ?? ""
                        : ""),
                  }
                : {}),
              ...(patch.ponto !== undefined ? { pontoExato: patch.ponto } : {}),
              ...(patch.latitude !== undefined ? { latitude: patch.latitude } : {}),
              ...(patch.longitude !== undefined ? { longitude: patch.longitude } : {}),
            })
          }
        />

        {/* Recebedor */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Recebedor</Label>
            <Combobox
              options={funcionarios}
              value={parada.recebedorPrevistoFuncionarioId ?? ""}
              disabled={desabilitado || externo}
              placeholder="Quem confere a entrega"
              searchPlaceholder="Buscar funcionário..."
              onChange={(v) => onChange({ recebedorPrevistoFuncionarioId: v || null })}
            />
          </div>

          <label className="flex items-center gap-2 text-[11px]">
            <Checkbox
              checked={externo}
              disabled={desabilitado}
              onCheckedChange={(c) => {
                const v = c === true;
                setExterno(v);
                onChange(
                  v ? { recebedorPrevistoFuncionarioId: null } : { recebedorPrevistoNome: "" },
                );
              }}
              data-testid={`ct4-recebedor-externo-${ordem}`}
            />
            Cadastrar recebedor externo (nome livre)
          </label>

          {externo && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Nome do recebedor</Label>
              <Input
                value={parada.recebedorPrevistoNome}
                disabled={desabilitado}
                placeholder="Digite o nome de quem receberá no local..."
                onChange={(e) => onChange({ recebedorPrevistoNome: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <Label className="text-[11px]">Observação da parada</Label>
          <Textarea
            value={parada.observacao}
            disabled={desabilitado}
            rows={3}
            placeholder="Digite aqui informações relevantes para o motorista ou conferente..."
            onChange={(e) => onChange({ observacao: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
};


export default ParadaEditor;
