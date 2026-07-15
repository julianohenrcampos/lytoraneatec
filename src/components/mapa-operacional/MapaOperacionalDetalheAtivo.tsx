import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Crosshair, ExternalLink, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_COLORS,
  type MapaOperacionalAtivo,
} from "@/services/mapa-operacional/mapaOperacionalService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  ativo: MapaOperacionalAtivo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCentralizar: (id: string) => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function MapaOperacionalDetalheAtivo({
  ativo,
  open,
  onOpenChange,
  onCentralizar,
}: Props) {
  const navigate = useNavigate();
  if (!ativo) return null;

  const colors = STATUS_COLORS[ativo.status_mapa];
  const tituloFrota = [ativo.frota, ativo.numero_frota].filter(Boolean).join(" ").trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {tituloFrota || ativo.placa || "Ativo"}
          </DialogTitle>
          <DialogDescription>Detalhe operacional do ativo</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="outline" className={cn(colors.badgeClass)}>
              {colors.label}
            </Badge>
            {ativo.situacao_veiculo && (
              <Badge variant="secondary">{ativo.situacao_veiculo}</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 mt-2">
          <div>
            <Row label="Placa" value={ativo.placa} />
            <Row label="Categoria" value={ativo.categoria_nome} />
            <Row label="Subcategoria" value={ativo.subcategoria_nome} />
            <Row label="Centro de Custo" value={ativo.centro_custo_nome} />
            <Row label="Operador" value={ativo.operador_nome} />
          </div>
          <div>
            <Row
              label="Apontamento"
              value={(() => {
                if (!ativo.data_apontamento) return "—";
                // data_apontamento vem como 'YYYY-MM-DD' do banco (data pura, sem TZ)
                const [y, m, d] = String(ativo.data_apontamento).slice(0, 10).split("-");
                const dataBR = d && m && y ? `${d}/${m}/${y}` : ativo.data_apontamento;
                const horaBR = ativo.hora_apontamento
                  ? String(ativo.hora_apontamento).slice(0, 5)
                  : "";
                return horaBR ? `${dataBR} · ${horaBR}` : dataBR;
              })()}
            />
            <Row
              label="Tempo:"
              value={formatDistanceToNow(new Date(ativo.data_registro), {
                addSuffix: true,
                locale: ptBR,
              })}
            />
            <Row
              label="Horímetro/KM"
              value={ativo.horimetro_final != null ? String(ativo.horimetro_final) : "—"}
            />
            <Row
              label="Não conformidades"
              value={
                <span className={ativo.qtd_nao_ok > 0 ? "text-red-500" : ""}>
                  {ativo.qtd_nao_ok}
                </span>
              }
            />
          </div>
        </div>

        <Separator className="my-2" />

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/gestao-maquinas/caminhoes?focus=${ativo.equipamento_id}`)
            }
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Ver equipamento
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/requisicoes/apontamento-caminhoes?focus=${ativo.apontamento_id}`)
            }
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Ver apontamento
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCentralizar(ativo.equipamento_id)}
          >
            <Crosshair className="h-4 w-4 mr-2" /> Centralizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
