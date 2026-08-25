/**
 * Drawer de detalhe dos nós do organograma. Somente leitura: reaproveita
 * os indicadores já agregados e aplica filtros na própria Central.
 */
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";
import { ScoreBar } from "../qualidadeUi";
import { responsavelInativo } from "./AdmSedeNode";
import type {
  QcEstruturaCc,
  QcEstruturaObra,
  QcEstruturaSede,
} from "@/services/qualidadeCadastralService";

export type NoSelecionado =
  | { tipo: "sede"; sede: QcEstruturaSede }
  | { tipo: "obra"; obra: QcEstruturaObra; sedeNome: string | null }
  | { tipo: "cc"; cc: QcEstruturaCc };

interface Props {
  selecionado: NoSelecionado | null;
  onClose: () => void;
  onFiltrarResponsavel: (nome: string) => void;
  onFiltrarCriticasResponsavel: (nome: string) => void;
  onFiltrarCentroCusto: (ccId: string) => void;
}

const Linha = ({ label, valor }: { label: string; valor: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{valor}</span>
  </div>
);

export default function ResponsabilidadeDetail({
  selecionado,
  onClose,
  onFiltrarResponsavel,
  onFiltrarCriticasResponsavel,
  onFiltrarCentroCusto,
}: Props) {
  const navigate = useNavigate();
  const aberto = !!selecionado;

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {selecionado?.tipo === "sede" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{selecionado.sede.sede_nome ?? "—"}</SheetTitle>
              <SheetDescription>ADM Sede</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              <Linha label="ADM Obra vinculados" valor={selecionado.sede.total_obras} />
              <Linha label="Centros de Custo" valor={selecionado.sede.total_cc} />
              <Linha label="Pendências" valor={selecionado.sede.pendencias} />
              <Linha label="Críticas" valor={selecionado.sede.criticas} />
              <div className="pt-2"><ScoreBar score={selecionado.sede.score} /></div>
              {responsavelInativo(selecionado.sede.sede_status) && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Responsável inativo
                </Badge>
              )}
            </div>
            <Separator className="my-4" />
            <p className="mb-2 text-xs font-medium text-muted-foreground">ADM Obra sob esta sede</p>
            <ul className="space-y-1 text-sm">
              {selecionado.sede.adm_obras.map((o) => (
                <li key={o.obra_id ?? "sem"} className="flex justify-between gap-2">
                  <span className="truncate">{o.obra_nome ?? "ADM OBRA não definido"}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {o.total_cc} CC · {o.pendencias} pend.
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                size="sm"
                disabled={!selecionado.sede.sede_nome}
                onClick={() => onFiltrarResponsavel(selecionado.sede.sede_nome!)}
              >
                Filtrar dashboard por este responsável
              </Button>
            </div>
          </>
        )}

        {selecionado?.tipo === "obra" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">
                {selecionado.obra.obra_nome ?? "ADM OBRA não definido"}
              </SheetTitle>
              <SheetDescription>
                ADM Obra · ADM Sede: {selecionado.sedeNome ?? "não definido"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              <Linha label="Centros de Custo" valor={selecionado.obra.total_cc} />
              <Linha label="Pendências" valor={selecionado.obra.pendencias} />
              <Linha label="Críticas" valor={selecionado.obra.criticas} />
              <div className="pt-2"><ScoreBar score={selecionado.obra.score} /></div>
              {responsavelInativo(selecionado.obra.obra_status) && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Responsável inativo
                </Badge>
              )}
            </div>
            <Separator className="my-4" />
            <p className="mb-2 text-xs font-medium text-muted-foreground">Centros de Custo</p>
            <ul className="space-y-1 text-sm">
              {selecionado.obra.centros_custo.map((cc) => (
                <li key={cc.cc_id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {cc.codigo} · {cc.nome}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {cc.score}% · {cc.pendencias} pend.
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                size="sm"
                disabled={!selecionado.obra.obra_nome}
                onClick={() => onFiltrarResponsavel(selecionado.obra.obra_nome!)}
              >
                Ver pendências deste ADM Obra
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selecionado.obra.obra_nome || selecionado.obra.criticas === 0}
                onClick={() => onFiltrarCriticasResponsavel(selecionado.obra.obra_nome!)}
              >
                Ver apenas críticas
              </Button>
            </div>
          </>
        )}

        {selecionado?.tipo === "cc" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{selecionado.cc.codigo ?? "—"}</SheetTitle>
              <SheetDescription>{selecionado.cc.nome ?? "Sem nome"}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              <Linha label="Situação" valor={selecionado.cc.situacao ?? "—"} />
              <Linha label="ADM Obra" valor={selecionado.cc.obra_nome ?? "não definido"} />
              <Linha label="ADM Sede" valor={selecionado.cc.sede_nome ?? "não definido"} />
              <Linha label="Pendências" valor={selecionado.cc.pendencias} />
              <Linha label="Críticas" valor={selecionado.cc.criticas} />
              <div className="pt-2"><ScoreBar score={selecionado.cc.score} /></div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button size="sm" onClick={() => onFiltrarCentroCusto(selecionado.cc.cc_id)}>
                Filtrar Central por {selecionado.cc.codigo}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate(
                    `/gestao-rh/centros-custo?busca=${encodeURIComponent(selecionado.cc.codigo ?? "")}`,
                  )
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir cadastro do Centro de Custo
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
