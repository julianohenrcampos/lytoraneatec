import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Clock, MapPin, Truck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_COLORS,
  type MapaOperacionalAtivo,
} from "@/services/mapa-operacional/mapaOperacionalService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  ativos: MapaOperacionalAtivo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapaOperacionalPainelLateral({ ativos, selectedId, onSelect }: Props) {
  if (ativos.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Nenhum ativo para os filtros atuais.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-2">
        {ativos.map((a) => {
          const colors = STATUS_COLORS[a.status_mapa];
          const selected = selectedId === a.equipamento_id;
          return (
            <Card
              key={a.equipamento_id}
              onClick={() => onSelect(a.equipamento_id)}
              className={cn(
                "p-3 cursor-pointer transition-colors border-l-4",
                selected ? "ring-2 ring-primary" : "hover:bg-accent/40",
              )}
              style={{ borderLeftColor: colors.mapboxColor }}
            >
              <div className="flex items-start gap-3">
                {a.imagem_url ? (
                  <img
                    src={a.imagem_url}
                    alt=""
                    className="h-12 w-12 rounded object-cover shrink-0 border"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted shrink-0 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate text-sm">
                        {a.frota} {a.numero_frota}
                        {a.placa ? (
                          <span className="text-muted-foreground"> · {a.placa}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.subcategoria_nome || a.categoria_nome || "—"}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(colors.badgeClass, "shrink-0")}>
                      {colors.label}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />
                      {a.centro_custo_nome || "Sem CC"}
                    </div>
                    {a.operador_nome && (
                      <div className="flex items-center gap-1 truncate">
                        <User className="h-3 w-3" /> {a.operador_nome}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(a.data_registro), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                    {a.qtd_nao_ok > 0 && (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertTriangle className="h-3 w-3" />
                        {a.qtd_nao_ok} item(ns) NÃO OK
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
