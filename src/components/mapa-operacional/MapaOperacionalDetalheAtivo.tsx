import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Copy, Crosshair, ExternalLink, Info, Truck } from "lucide-react";
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
    <div className="flex items-start justify-between gap-4 text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function MapaOperacionalDetalheAtivo({ ativo, open, onOpenChange, onCentralizar }: Props) {
  const navigate = useNavigate();
  if (!ativo) return null;

  const colors = STATUS_COLORS[ativo.status_mapa];
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${ativo.latitude}, ${ativo.longitude}`);
      toast({ title: "Coordenadas copiadas" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {ativo.frota} {ativo.numero_frota}
          </SheetTitle>
          <SheetDescription>Detalhe operacional do ativo</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {ativo.imagem_url && (
            <img
              src={ativo.imagem_url}
              alt=""
              className="w-full h-40 object-cover rounded border"
            />
          )}

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(colors.badgeClass)}>
              {colors.label}
            </Badge>
            {ativo.situacao_veiculo && (
              <Badge variant="secondary">{ativo.situacao_veiculo}</Badge>
            )}
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Posição referente à última localização registrada. Não é rastreamento em tempo real.
            </AlertDescription>
          </Alert>

          <div>
            <Row label="Placa" value={ativo.placa} />
            <Row label="Categoria" value={ativo.categoria_nome} />
            <Row label="Subcategoria" value={ativo.subcategoria_nome} />
            <Row label="Centro de Custo" value={ativo.centro_custo_nome} />
            <Row label="Operador" value={ativo.operador_nome} />
            <Separator className="my-2" />
            <Row
              label="Apontamento"
              value={
                ativo.data_apontamento
                  ? `${ativo.data_apontamento}${ativo.hora_apontamento ? " · " + ativo.hora_apontamento : ""}`
                  : "—"
              }
            />
            <Row
              label="Localização registrada"
              value={new Date(ativo.data_registro).toLocaleString("pt-BR")}
            />
            <Row
              label="Idade da localização"
              value={formatDistanceToNow(new Date(ativo.data_registro), {
                addSuffix: true,
                locale: ptBR,
              })}
            />
            <Row
              label="Precisão GPS"
              value={
                ativo.precisao_gps != null ? `${Math.round(ativo.precisao_gps)} m` : "—"
              }
            />
            <Row
              label="Horímetro/KM"
              value={ativo.horimetro_final != null ? String(ativo.horimetro_final) : "—"}
            />
            <Separator className="my-2" />
            <Row label="Checklist" value={ativo.checklist_codigo || "—"} />
            <Row label="Total de itens" value={ativo.total_checklist} />
            <Row
              label="Não conformidades"
              value={
                <span className={ativo.qtd_nao_ok > 0 ? "text-red-500" : ""}>
                  {ativo.qtd_nao_ok}
                </span>
              }
            />
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
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
            <Button variant="outline" size="sm" onClick={() => onCentralizar(ativo.equipamento_id)}>
              <Crosshair className="h-4 w-4 mr-2" /> Centralizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!ativo.coordenada_precisa}
              onClick={copiar}
              title={
                ativo.coordenada_precisa
                  ? "Copiar coordenadas"
                  : "Coordenadas exatas requerem permissão dedicada"
              }
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar coordenadas
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
