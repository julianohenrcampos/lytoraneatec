import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Truck } from "lucide-react";
import { Veiculo } from "@/types/veiculo";
import { formatIdentificadorFromVeiculo, formatNumeroFrota } from "@/utils/formatIdentificadorAtivo";

interface VeiculoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
}

const DetailItem = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="text-sm">{value || "Não informado"}</p>
  </div>
);

const VeiculoDetailsModal: React.FC<VeiculoDetailsModalProps> = ({ isOpen, onClose, veiculo }) => {
  if (!veiculo) return null;

  const identificador = formatIdentificadorFromVeiculo(veiculo);
  const fabricante = veiculo.fabricante_nome || veiculo.fabricante || null;
  const modelo = veiculo.modelo_nome || null;
  const frotaCodigo = veiculo.frota_codigo || veiculo.frota || null;
  const numeroFrotaFmt = formatNumeroFrota(veiculo.numero_frota);
  const proprietario = veiculo.nome_empresa_locadora || veiculo.nome_empresa || null;
  const centroCusto = veiculo.centro_custo_atual_nome || veiculo.nome_centro_custo || null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Ativo — {identificador}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 flex flex-col items-center">
            <Avatar className="h-32 w-32">
              {veiculo.imagem_url ? (
                <AvatarImage src={veiculo.imagem_url} alt={identificador} />
              ) : (
                <AvatarFallback className="bg-primary/10">
                  <Truck className="h-16 w-16 text-primary" />
                </AvatarFallback>
              )}
            </Avatar>

            <div className="text-center mt-2">
              <p className="text-lg font-bold">{identificador}</p>
              <p className="text-sm text-muted-foreground">
                {[fabricante, veiculo.nome_subcategoria].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <DetailItem label="Categoria" value={veiculo.nome_categoria} />
              <DetailItem label="Subcategoria" value={veiculo.nome_subcategoria} />
              <DetailItem label="Fabricante" value={fabricante} />
              <DetailItem label="Modelo" value={modelo} />
              <DetailItem label="Frota" value={frotaCodigo} />
              <DetailItem label="Número da Frota" value={numeroFrotaFmt} />
              <DetailItem label="Placa" value={veiculo.placa} />
              <DetailItem label="Nº de Série" value={veiculo.numero_serie} />
              <DetailItem label="Chassi" value={veiculo.chassi} />
              <DetailItem label="Cor" value={veiculo.cor} />
              <DetailItem label="Motor" value={veiculo.motor} />
              <DetailItem label="Ano de Fabricação" value={veiculo.ano_fabricacao} />
              <DetailItem label="Combustível" value={veiculo.tipo_combustivel} />
              <DetailItem label="Status IPVA" value={veiculo.status_ipva} />
              <DetailItem label="Situação" value={veiculo.situacao} />
              <DetailItem label="Capacidade" value={veiculo.capacidade} />
              <DetailItem label="Aluguel" value={veiculo.aluguel} />
              <DetailItem label="Departamento" value={veiculo.nome_departamento} />
              <DetailItem label="Proprietário" value={proprietario} />
              <DetailItem label="Centro de Custo" value={centroCusto} />
            </div>

            {veiculo.informacoes_complementares && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Informações Complementares</p>
                <p className="text-sm">{veiculo.informacoes_complementares}</p>
              </div>
            )}

            {veiculo.observacoes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Observações</p>
                <p className="text-sm">{veiculo.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VeiculoDetailsModal;
