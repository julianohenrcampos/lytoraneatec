import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Car,
  ClipboardList,
  Factory,
  Fingerprint,
  Fuel,
  Gauge,
  Hash,
  Info,
  Layers,
  MapPin,
  Palette,
  ReceiptText,
  Settings2,
  Tag,
  Truck,
  Wallet,
  Wrench,
  CalendarDays,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Veiculo } from "@/types/veiculo";
import { formatIdentificadorFromVeiculo, formatNumeroFrota } from "@/utils/formatIdentificadorAtivo";
import { fetchEstadoOperacionalAtivo } from "@/services/disponibilidadeEquipamentoService";
import { rotuloCentroCusto } from "@/lib/ativos/reconciliacaoOperacional";
import { usePermission } from "@/hooks/usePermission";
import DisponibilidadeAtivoModal from "@/components/disponibilidade/DisponibilidadeAtivoModal";
import AssetInfoSection from "./detalhes/AssetInfoSection";
import AssetInfoItem from "./detalhes/AssetInfoItem";
import DisponibilidadeOperacionalCard from "./detalhes/DisponibilidadeOperacionalCard";
import {
  formatAluguelBRL,
  formatAnoFabricacao,
  formatCapacidade,
} from "./detalhes/formatadores";

interface VeiculoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
}

const VeiculoDetailsModal: React.FC<VeiculoDetailsModalProps> = ({ isOpen, onClose, veiculo }) => {
  const [regularizando, setRegularizando] = useState(false);
  const queryClient = useQueryClient();
  const { hasActionPermission, isLoading: permissoesCarregando } = usePermission();
  const podeEditarDisponibilidade =
    !permissoesCarregando &&
    hasActionPermission("gestao_maquinas_central_transporte_view", "editar");

  // Disponibilidade operacional é LIDA do registro operacional — nunca inferida de `situacao`.
  const {
    data: estadoOperacional,
    isLoading: carregandoEstado,
    isError: erroEstado,
  } = useQuery({
    queryKey: ["estado-operacional-ativo", veiculo?.id],
    queryFn: () => fetchEstadoOperacionalAtivo(veiculo!.id as string),
    enabled: isOpen && !!veiculo?.id,
    retry: false,
  });

  if (!veiculo) return null;

  const identificador = formatIdentificadorFromVeiculo(veiculo);
  const fabricante = veiculo.fabricante_nome || veiculo.fabricante || null;
  const modelo = veiculo.modelo_nome || veiculo.modelo || null;
  const frotaCodigo = veiculo.frota_codigo || veiculo.frota || null;
  const numeroFrotaFmt = formatNumeroFrota(veiculo.numero_frota);
  const proprietario = veiculo.nome_empresa_locadora || veiculo.nome_empresa || null;
  // Três estados distintos: resolvido / referência não localizada / sem CC.
  const centroCusto = rotuloCentroCusto({
    centroCustoAtualId: veiculo.centro_custo_atual_id ?? null,
    centroCustoAtualCodigo: veiculo.centro_custo_atual_codigo ?? null,
    centroCustoAtualNome: veiculo.centro_custo_atual_nome ?? veiculo.nome_centro_custo ?? null,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent
        className="flex max-h-[calc(100vh-32px)] w-[min(1080px,calc(100vw-24px))] max-w-[min(1080px,calc(100vw-24px))] flex-col gap-0 overflow-hidden p-0 sm:w-[min(1080px,calc(100vw-48px))] sm:max-w-[min(1080px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="break-words">Detalhes do Ativo — {identificador}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Consulta dos dados cadastrais e da disponibilidade operacional do ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-5 py-4">
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Resumo do ativo */}
            <aside className="rounded-lg border border-border/70 bg-card p-4">
              <div className="mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-lg bg-muted/50">
                {veiculo.imagem_url ? (
                  <img
                    src={veiculo.imagem_url}
                    alt={`Imagem do ativo ${identificador}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                      <Truck className="h-10 w-10 text-primary" aria-hidden="true" />
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-xl font-bold leading-tight text-foreground">{identificador}</p>
                <p className="text-sm text-muted-foreground">{fabricante || "Fabricante não informado"}</p>
                <p className="text-sm font-medium text-foreground">
                  {veiculo.nome_subcategoria || veiculo.nome_categoria || "Tipo não informado"}
                </p>
              </div>

              <div className="mt-4 border-t border-border/60 pt-3">
                <AssetInfoItem
                  icon={Car}
                  label="Placa"
                  value={veiculo.placa}
                  emptyLabel="Não informada"
                />
              </div>
            </aside>

            {/* Blocos de consulta */}
            <div className="space-y-4">
              <AssetInfoSection title="Informações gerais" icon={Info}>
                <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                  <AssetInfoItem icon={Layers} label="Categoria" value={veiculo.nome_categoria} />
                  <AssetInfoItem icon={Tag} label="Subcategoria" value={veiculo.nome_subcategoria} />
                  <AssetInfoItem icon={Factory} label="Fabricante" value={fabricante} />
                  <AssetInfoItem icon={Settings2} label="Modelo" value={modelo} />
                  <AssetInfoItem icon={Truck} label="Frota" value={frotaCodigo} />
                  <AssetInfoItem icon={Hash} label="Número da Frota" value={numeroFrotaFmt} />
                  <AssetInfoItem icon={Car} label="Placa" value={veiculo.placa} />
                  <AssetInfoItem icon={Fingerprint} label="Nº de Série" value={veiculo.numero_serie} />
                </div>
              </AssetInfoSection>

              <AssetInfoSection title="Características" icon={Wrench}>
                <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                  <AssetInfoItem icon={Fingerprint} label="Chassi" value={veiculo.chassi} />
                  <AssetInfoItem icon={Palette} label="Cor" value={veiculo.cor} />
                  <AssetInfoItem icon={Settings2} label="Motor" value={veiculo.motor} />
                  <AssetInfoItem
                    icon={CalendarDays}
                    label="Ano de Fabricação"
                    value={formatAnoFabricacao(veiculo.ano_fabricacao)}
                  />
                  <AssetInfoItem icon={Fuel} label="Combustível" value={veiculo.tipo_combustivel} />
                  <AssetInfoItem icon={ReceiptText} label="Status IPVA" value={veiculo.status_ipva} />
                  <AssetInfoItem
                    icon={ClipboardList}
                    label="Situação cadastral"
                    value={
                      veiculo.situacao ? (
                        <Badge variant="outline" className="font-medium">
                          {veiculo.situacao}
                        </Badge>
                      ) : null
                    }
                  />
                  <AssetInfoItem
                    icon={Gauge}
                    label="Capacidade"
                    value={formatCapacidade(veiculo.capacidade)}
                  />
                </div>
              </AssetInfoSection>

              <AssetInfoSection title="Alocação atual" icon={MapPin}>
                <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                  <AssetInfoItem
                    icon={Wallet}
                    label="Aluguel"
                    value={formatAluguelBRL(veiculo.aluguel)}
                  />
                  <AssetInfoItem icon={Building2} label="Departamento" value={veiculo.nome_departamento} />
                  <AssetInfoItem icon={Factory} label="Proprietário" value={proprietario} />
                  <AssetInfoItem
                    icon={MapPin}
                    label="Centro de Custo atual"
                    value={centroCusto}
                    tooltip={centroCusto}
                    valueClassName="whitespace-normal"
                  />
                </div>
              </AssetInfoSection>

              {(veiculo.informacoes_complementares || veiculo.observacoes) && (
                <AssetInfoSection title="Complementos" icon={ClipboardList}>
                  <div className="grid gap-x-6 gap-y-0.5">
                    {veiculo.informacoes_complementares && (
                      <AssetInfoItem
                        label="Informações complementares"
                        value={veiculo.informacoes_complementares}
                      />
                    )}
                    {veiculo.observacoes && (
                      <AssetInfoItem label="Observações" value={veiculo.observacoes} />
                    )}
                  </div>
                </AssetInfoSection>
              )}
            </div>
          </div>

          <DisponibilidadeOperacionalCard
            estado={estadoOperacional}
            isLoading={carregandoEstado}
            isError={erroEstado}
            podeEditar={podeEditarDisponibilidade}
            onEditar={() => setRegularizando(true)}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 bg-background px-5 py-3">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>

        {regularizando && veiculo.id && (
          <DisponibilidadeAtivoModal
            open
            onClose={() => setRegularizando(false)}
            equipamentoId={veiculo.id as string}
            identificacao={identificador}
            situacaoCadastral={veiculo.situacao}
            centroCustoIdSugerido={veiculo.centro_custo_atual_id ?? null}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["estado-operacional-ativo", veiculo.id] });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VeiculoDetailsModal;
