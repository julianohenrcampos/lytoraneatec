/**
 * CT-3C R2 — Card editável de uma viagem da mobilização.
 *
 * Campos por modalidade:
 *  - RODANTE: exatamente 1 ativo + motorista/operador (bd_funcionarios);
 *  - TRANSPORTADO PROPRIO: veículo transportador + motorista;
 *  - TRANSPORTADO TERCEIRO: transportadora + placa + nome do motorista.
 *
 * O card só envia IDs e textos não canônicos: nome, CPF, placa e endereços de
 * centro de custo são resolvidos no servidor.
 */
import React from "react";
import { Trash2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CT_MODALIDADE_LABELS,
  CT_TIPO_TRANSPORTE_LABELS,
  type CtAtivoMobilizavel,
  type CtModalidade,
  type CtTipoTransporte,
  type CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";
import { rotuloAtivo } from "@/lib/central-transporte/mobilizacaoRascunho";
import ViagemEnderecosEditor from "./ViagemEnderecosEditor";

const MODALIDADES: CtModalidade[] = ["RODANTE", "TRANSPORTADO"];
const TIPOS: CtTipoTransporte[] = ["PROPRIO", "TERCEIRO"];

export interface ViagemCardEditorProps {
  viagem: CtViagemRascunho;
  indice: number;
  ativos: CtAtivoMobilizavel[];
  problemas: string[];
  somenteLeitura: boolean;
  cadastros: {
    motoristas: ComboboxOption[];
    veiculos: ComboboxOption[];
    empresas: ComboboxOption[];
    centrosCusto: ComboboxOption[];
  };
  /** CT-3D — endereço cadastrado dos CCs escolhidos (null quando ausente). */
  origemCcEndereco: string | null;
  destinoCcEndereco: string | null;
  onPatch: (patch: Partial<CtViagemRascunho>) => void;
  onRemover: () => void;
  onRemoverAtivo: (atendimentoId: string) => void;
}

export const ViagemCardEditor: React.FC<ViagemCardEditorProps> = ({
  viagem,
  indice,
  ativos,
  problemas,
  somenteLeitura,
  cadastros,
  origemCcEndereco,
  destinoCcEndereco,
  onPatch,
  onRemover,
  onRemoverAtivo,
}) => {
  const transportado = viagem.modalidade === "TRANSPORTADO";
  const terceiro = transportado && viagem.tipoTransporte === "TERCEIRO";
  const proprio = transportado && viagem.tipoTransporte === "PROPRIO";
  const exigeMotoristaCadastrado = viagem.modalidade === "RODANTE" || proprio;

  const ativosDaViagem = viagem.atendimentoIds
    .map((at) => ativos.find((a) => a.atendimentoId === at))
    .filter((a): a is CtAtivoMobilizavel => !!a);

  return (
    <Card data-testid={`ct3c-viagem-card-${viagem.chaveLocal}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <Truck className="h-4 w-4 text-primary" />
          {viagem.codigo ?? `Viagem ${indice + 1}`}
          {viagem.modalidade && (
            <Badge variant="secondary" className="text-[10px]">
              {viagem.modalidade === "RODANTE" ? "Rodante" : "Transportado"}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {viagem.atendimentoIds.length} ativo(s)
          </Badge>
        </CardTitle>
        {!somenteLeitura && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remover viagem"
            data-testid={`ct3c-remover-viagem-${viagem.chaveLocal}`}
            onClick={onRemover}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3 text-xs">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Modalidade</Label>
            <Combobox
              disabled={somenteLeitura}
              value={viagem.modalidade ?? ""}
              placeholder="Selecione a modalidade"
              options={MODALIDADES.map((m) => ({ value: m, label: CT_MODALIDADE_LABELS[m] }))}
              onChange={(v) =>
                onPatch({
                  modalidade: (v || null) as CtModalidade | null,
                  tipoTransporte: v === "TRANSPORTADO" ? viagem.tipoTransporte : null,
                })
              }
            />
          </div>

          {transportado && (
            <div className="space-y-1">
              <Label className="text-[11px]">Tipo de transporte</Label>
              <Combobox
                disabled={somenteLeitura}
                value={viagem.tipoTransporte ?? ""}
                placeholder="Próprio ou terceiro"
                options={TIPOS.map((t) => ({ value: t, label: CT_TIPO_TRANSPORTE_LABELS[t] }))}
                onChange={(v) => onPatch({ tipoTransporte: (v || null) as CtTipoTransporte | null })}
              />
            </div>
          )}

          {exigeMotoristaCadastrado && (
            <div className="space-y-1">
              <Label className="text-[11px]">
                {viagem.modalidade === "RODANTE" ? "Motorista / operador" : "Motorista do transporte"}
              </Label>
              <Combobox
                disabled={somenteLeitura}
                value={viagem.motoristaId ?? ""}
                placeholder="Selecione o funcionário"
                searchPlaceholder="Buscar por nome ou CPF..."
                options={cadastros.motoristas}
                onChange={(v) => onPatch({ motoristaId: v || null })}
              />
            </div>
          )}

          {proprio && (
            <div className="space-y-1">
              <Label className="text-[11px]">Veículo transportador</Label>
              <Combobox
                disabled={somenteLeitura}
                value={viagem.veiculoTransportadorId ?? ""}
                placeholder="Prancha, carreta ou caminhão"
                searchPlaceholder="Buscar por frota ou placa..."
                options={cadastros.veiculos}
                onChange={(v) => onPatch({ veiculoTransportadorId: v || null })}
              />
            </div>
          )}

          {terceiro && (
            <>
              <div className="space-y-1">
                <Label className="text-[11px]">Transportadora</Label>
                <Combobox
                  disabled={somenteLeitura}
                  value={viagem.empresaTransportadoraId ?? ""}
                  placeholder="Selecione a empresa"
                  searchPlaceholder="Buscar por nome ou CNPJ..."
                  options={cadastros.empresas}
                  onChange={(v) => onPatch({ empresaTransportadoraId: v || null })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Placa do transportador</Label>
                <Input
                  disabled={somenteLeitura}
                  value={viagem.placaTransportador}
                  placeholder="ABC1D23"
                  onChange={(e) => onPatch({ placaTransportador: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Motorista do terceiro</Label>
                <Input
                  disabled={somenteLeitura}
                  value={viagem.motoristaNome}
                  placeholder="Nome completo"
                  onChange={(e) => onPatch({ motoristaNome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">CPF do motorista (opcional)</Label>
                <Input
                  disabled={somenteLeitura}
                  value={viagem.motoristaCpf}
                  placeholder="Somente números"
                  onChange={(e) => onPatch({ motoristaCpf: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-[11px]">Saída prevista (opcional)</Label>
            <Input
              type="date"
              disabled={somenteLeitura}
              value={viagem.dataPrevistaSaida}
              onChange={(e) => onPatch({ dataPrevistaSaida: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Data da mobilização</Label>
            <Input
              type="date"
              disabled={somenteLeitura}
              data-testid={`ct3c-data-mobilizacao-${viagem.chaveLocal}`}
              value={viagem.dataProgramada}
              onChange={(e) => onPatch({ dataProgramada: e.target.value })}
            />
          </div>
        </div>

        <ViagemEnderecosEditor
          viagem={viagem}
          somenteLeitura={somenteLeitura}
          origemCcEndereco={origemCcEndereco}
          destinoCcEndereco={destinoCcEndereco}
          funcionarios={cadastros.motoristas}
          centrosCusto={cadastros.centrosCusto}
          onPatch={onPatch}
        />




        <div className="space-y-1">
          <Label className="text-[11px]">Observações</Label>
          <Textarea
            rows={2}
            disabled={somenteLeitura}
            value={viagem.observacoes}
            onChange={(e) => onPatch({ observacoes: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">Ativos desta viagem</p>
          {ativosDaViagem.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Nenhum ativo agrupado — use o painel de ativos pendentes.
            </p>
          ) : (
            <ul className="space-y-1">
              {ativosDaViagem.map((a) => (
                <li
                  key={a.atendimentoId}
                  className="flex items-center justify-between rounded-md border px-2 py-1"
                >
                  <span>{rotuloAtivo(a)}</span>
                  {!somenteLeitura && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px]"
                      onClick={() => onRemoverAtivo(a.atendimentoId)}
                    >
                      Retirar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {problemas.length > 0 && (
          <ul
            className="list-disc space-y-0.5 pl-4 text-[11px] text-destructive"
            data-testid={`ct3c-problemas-${viagem.chaveLocal}`}
          >
            {problemas.map((p, i) => (
              <li key={`${viagem.chaveLocal}-p-${i}`}>{p}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default ViagemCardEditor;
