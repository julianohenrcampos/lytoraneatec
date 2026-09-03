/**
 * CT-4 UX — Formulário da parada selecionada (uma por vez).
 *
 * Fluxo unidirecional (o que → quando → para onde → quem recebe → observações),
 * reaproveitando `PontoOperacionalBloco` para endereço/mapa. A seleção de ativos
 * acontece EXCLUSIVAMENTE aqui, via catálogo server-side: só apresentação, a
 * elegibilidade vem do servidor.
 */
import React from "react";
import { MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PontoOperacionalBloco from "@/components/central-transporte/shared/PontoOperacionalBloco";
import CatalogoAtivosParada from "@/components/central-transporte/mov-direta/CatalogoAtivosParada";

import type {
  CtAtivoMovimentacao,
  CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";

interface Props {
  parada: CtParadaRascunho;
  ordem: number;
  centrosCusto: ComboboxOption[];
  enderecosCentroCusto: Record<string, string | null>;
  funcionarios: ComboboxOption[];
  /** Metadados já conhecidos dos ativos (para rotular chips após F5). */
  metadadosAtivos: Map<string, CtAtivoMovimentacao>;
  /** Onde cada equipamento já está alocado em OUTRAS paradas desta viagem. */
  alocadosEmOutrasParadas: Map<string, { indice: number; rotulo: string }>;
  podeRemover: boolean;
  desabilitado: boolean;
  onChange: (patch: Partial<CtParadaRascunho>) => void;
  onRemover: () => void;
  onConhecerAtivo?: (ativo: CtAtivoMovimentacao) => void;
  /** Builder: os ativos são atribuídos no canvas, não neste formulário. */
  ocultarAtivos?: boolean;
}

const ParadaEditor: React.FC<Props> = ({
  parada,
  ordem,
  centrosCusto,
  enderecosCentroCusto,
  funcionarios,
  metadadosAtivos,
  alocadosEmOutrasParadas,
  podeRemover,
  desabilitado,
  onChange,
  onRemover,
  onConhecerAtivo,
  ocultarAtivos = false,
}) => {
  const porId = metadadosAtivos;
  const [externo, setExterno] = React.useState(parada.recebedorPrevistoNome.trim().length > 0);




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
        {/* Ativos desta parada — catálogo server-side dentro da parada. */}
        {!ocultarAtivos && (
        <div className="space-y-2" data-testid={`ct4-ativos-parada-${ordem}`}>
          <div className="flex items-center gap-2">
            <Label className="text-[11px]">Ativos desta parada</Label>
            <Badge variant="outline" className="text-[10px]">
              {parada.equipamentos.length}
            </Badge>
          </div>

          <CatalogoAtivosParada
            ordem={ordem}
            selecionados={parada.equipamentos}
            alocadosEmOutrasParadas={alocadosEmOutrasParadas}
            metadados={porId}
            desabilitado={desabilitado}
            onChange={(equipamentos) => onChange({ equipamentos })}
            onConhecerAtivo={onConhecerAtivo}
          />
        </div>
        )}


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
