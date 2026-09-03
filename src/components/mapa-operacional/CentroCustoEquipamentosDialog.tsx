import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MapPin, MapPinOff, Search, Factory } from "lucide-react";
import type { MapaOperacionalCentroCusto } from "@/services/mapa-operacional/mapaOperacionalService";
import { traduzirSituacaoUI } from "./mapaOperacionalGeo";

interface Props {
  centroCusto: MapaOperacionalCentroCusto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CentroCustoEquipamentosDialog({ centroCusto, open, onOpenChange }: Props) {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!open) setBusca("");
  }, [open]);

  const equipamentos = centroCusto?.equipamentos ?? [];

  const ordenados = useMemo(() => {
    const arr = [...equipamentos];
    arr.sort((a, b) => {
      if (a.tem_gps !== b.tem_gps) return a.tem_gps ? -1 : 1;
      const fa = `${a.frota ?? ""} ${a.numero_frota ?? ""}`.trim().toLowerCase();
      const fb = `${b.frota ?? ""} ${b.numero_frota ?? ""}`.trim().toLowerCase();
      if (fa !== fb) return fa.localeCompare(fb);
      return (a.placa ?? "").localeCompare(b.placa ?? "");
    });
    return arr;
  }, [equipamentos]);

  const filtrados = useMemo(() => {
    if (!buscaDeb) return ordenados;
    return ordenados.filter((e) => {
      const hay = [
        e.frota,
        e.numero_frota,
        e.placa,
        e.situacao,
        traduzirSituacaoUI(e.situacao),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(buscaDeb);
    });
  }, [ordenados, buscaDeb]);

  if (!centroCusto) return null;

  const titulo = centroCusto.codigo
    ? `${centroCusto.codigo} — ${centroCusto.nome ?? ""}`
    : centroCusto.nome ?? "Centro de Custo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-start gap-2 text-base">
            <Factory className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="min-w-0">{titulo}</span>
          </DialogTitle>
          {centroCusto.endereco && (
            <p className="text-xs text-muted-foreground pl-7">{centroCusto.endereco}</p>
          )}
          <div className="flex flex-wrap gap-2 pl-7 pt-2">
            <Badge variant="secondary">Alocados: {centroCusto.total_alocados ?? 0}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15">
              Com GPS: {centroCusto.total_com_gps ?? 0}
            </Badge>
            <Badge variant="outline">Sem GPS: {centroCusto.total_sem_gps ?? 0}</Badge>
          </div>
        </DialogHeader>

        <Separator />

        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por frota, número, placa ou situação..."
              className="pl-8"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[55vh] px-5 pb-5">
          {equipamentos.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum equipamento alocado neste centro de custo.
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum equipamento encontrado para esta busca.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtrados.map((e) => {
                const frotaLabel = [e.frota, e.numero_frota].filter(Boolean).join(" ").trim();
                const label = frotaLabel || e.placa || "Equipamento";
                const situ = traduzirSituacaoUI(e.situacao);
                return (
                  <li
                    key={e.equipamento_id}
                    className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {e.placa || "Sem placa"}
                      </div>
                    </div>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {situ}
                    </Badge>
                    {e.tem_gps ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15 gap-1 whitespace-nowrap">
                        <MapPin className="h-3 w-3" /> Com GPS
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                        <MapPinOff className="h-3 w-3" /> Sem GPS
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
