import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ApontamentoCaminhao,
  ApontamentoInspecao,
  ChecklistValor,
  getSignedFotoUrl,
} from "@/services/apontamentoCaminhoesService";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { resolverGrupoVisual } from "./checklist/checklistGroupVisuals";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apontamento: ApontamentoCaminhao | null;
  inspecao: ApontamentoInspecao | null;
  isLoading: boolean;
}

const traduzirChecklist = (v: ChecklistValor | string | null | undefined): string => {
  if (v === "OK") return "Conforme";
  if (v === "NAO_OK") return "Não conforme";
  if (v === "NA") return "Não aplicável";
  return "—";
};

const CHECKLIST_ITEMS: { key: keyof ApontamentoInspecao; label: string }[] = [
  { key: "nivel_oleo", label: "Nível de Óleo" },
  { key: "nivel_agua", label: "Nível de Água" },
  { key: "nivel_combustivel", label: "Nível de Combustível" },
  { key: "pressao_pneus", label: "Pressão dos Pneus" },
  { key: "estado_pneus", label: "Estado dos Pneus" },
  { key: "luzes_funcionamento", label: "Luzes" },
  { key: "freios_funcionamento", label: "Freios" },
  { key: "direcao_funcionamento", label: "Direção" },
  { key: "equipamentos_seguranca", label: "Equipamentos de Segurança" },
  { key: "limpeza_veiculo", label: "Limpeza do Veículo" },
];

const ApontamentoCaminhoesDetailsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  apontamento,
  inspecao,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState("dados");
  const isMobile = useIsMobile();
  const [fotoUrls, setFotoUrls] = useState<Record<string, string | null>>({});

  // Snapshot detalhado (R3)
  const respostas: any = (inspecao as any)?.checklist_respostas || null;
  const isDetalhado = !!respostas && Array.isArray(respostas?.grupos);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const legadoPaths = (inspecao?.fotos_inspecao as string[] | null) || [];
      const snapPaths: string[] = isDetalhado
        ? (respostas.grupos || []).flatMap((g: any) =>
            (g.itens || []).flatMap((i: any) => (Array.isArray(i?.fotos) ? i.fotos : []))
          )
        : [];
      const paths = Array.from(new Set([...legadoPaths, ...snapPaths]));
      if (paths.length === 0) {
        setFotoUrls({});
        return;
      }
      const map: Record<string, string | null> = {};
      await Promise.all(
        paths.map(async (p) => {
          const u = await getSignedFotoUrl(p);
          map[p] = u;
        })
      );
      if (!cancel) setFotoUrls(map);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspecao?.id, inspecao?.fotos_inspecao, isDetalhado]);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={cn("sm:max-w-[600px]", isMobile ? "p-3 w-[95vw] mx-auto" : "")}>
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  if (!apontamento) return null;

  const isTruck =
    apontamento.veiculo_identificacao?.toLowerCase().includes("caminhão") ||
    (apontamento.veiculo_identificacao?.includes("-") &&
      apontamento.veiculo_identificacao?.includes(" "));

  const horimetroLabel = (isFinal = false) =>
    isTruck
      ? isFinal
        ? "Hodômetro Final (KM)"
        : "Hodômetro Inicial (KM)"
      : isFinal
      ? "Horímetro Final"
      : "Horímetro Inicial";

  const badge = () => {
    if (!inspecao) return null;
    if (inspecao.inspecao_aprovada === true) {
      return <Badge className="bg-green-100 text-green-800">Inspeção conforme</Badge>;
    }
    return <Badge variant="destructive">Inspeção com não conformidades</Badge>;
  };

  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("sm:max-w-[700px]", isMobile ? "p-3 w-[95vw] mx-auto" : "")}>
        <DialogHeader>
          <DialogTitle className="text-center sm:text-left">Detalhes do Apontamento</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full mb-4 grid-cols-2">
            <TabsTrigger value="dados">Dados Operacionais</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <ScrollArea className={cn("pr-4", isMobile ? "h-[55vh] max-h-[400px]" : "h-[400px]")}>
              <dl className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Data</dt>
                    <dd className="mt-1 text-base">
                      {formatBrazilianDateForDisplay(apontamento.data)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Operador</dt>
                    <dd className="mt-1 text-base">{show(apontamento.nome_operador)}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Caminhão/Equipamento
                  </dt>
                  <dd className="mt-1 text-base font-medium">
                    {show(apontamento.veiculo_identificacao)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Centro de Custo</dt>
                  <dd className="mt-1 text-base">{show(apontamento.nome_centro_custo)}</dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {horimetroLabel()}
                    </dt>
                    <dd className="mt-1 text-base">{show(apontamento.horimetro_inicial)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {horimetroLabel(true)}
                    </dt>
                    <dd className="mt-1 text-base">{show(apontamento.horimetro_final)}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Hora Inicial</dt>
                    <dd className="mt-1 text-base">{show(apontamento.hora_inicial)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Hora Final</dt>
                    <dd className="mt-1 text-base">{show(apontamento.hora_final)}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Situação</dt>
                    <dd className="mt-1 text-base">{show(apontamento.situacao)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Abastecimento</dt>
                    <dd className="mt-1 text-base">
                      {apontamento.abastecimento ? `${apontamento.abastecimento} L` : "—"}
                    </dd>
                  </div>
                </div>
              </dl>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="checklist">
            <ScrollArea className={cn("pr-4", isMobile ? "h-[55vh] max-h-[400px]" : "h-[400px]")}>
              {inspecao ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Status:</span>
                    {badge()}
                  </div>

                  {isDetalhado ? (
                    <div className="space-y-3">
                      {(respostas.grupos as any[]).map((g) => {
                        const visual = resolverGrupoVisual(g.codigo || g.titulo);
                        const Icon = visual.icon;
                        return (
                        <div
                          key={g.codigo || g.titulo}
                          className={cn(
                            "rounded-lg shadow-sm bg-card overflow-hidden",
                            visual.borderClassName
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 border-b",
                              visual.headerClassName
                            )}
                          >
                            <span className={cn(visual.iconContainerClassName)}>
                              <Icon className={cn("h-4 w-4", visual.iconClassName)} />
                            </span>
                            <div className="text-sm font-semibold uppercase tracking-wide">
                              {g.titulo || g.codigo}
                            </div>
                          </div>
                          <div className="p-3 space-y-2">

                            {(g.itens || []).map((it: any) => (
                              <div key={it.codigo} className="border-t pt-2 first:border-t-0 first:pt-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm">{it.descricao || it.codigo}</div>
                                  <Badge
                                    variant={
                                      it.status === "OK"
                                        ? "secondary"
                                        : it.status === "NAO_OK"
                                        ? "destructive"
                                        : "outline"
                                    }
                                    className={
                                      it.status === "OK" ? "bg-green-100 text-green-800" : ""
                                    }
                                  >
                                    {traduzirChecklist(it.status)}
                                  </Badge>
                                </div>
                                {it.observacao && (
                                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                    {it.observacao}
                                  </p>
                                )}
                                {Array.isArray(it.fotos) && it.fotos.length > 0 && (
                                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {it.fotos.map((p: string) => {
                                      const url = fotoUrls[p];
                                      return (
                                        <div
                                          key={p}
                                          className="relative aspect-square border rounded overflow-hidden"
                                        >
                                          {url ? (
                                            <img
                                              src={url}
                                              alt="Foto"
                                              className="object-cover w-full h-full"
                                            />
                                          ) : url === null ? (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                              Indisponível
                                            </div>
                                          ) : (
                                            <div className="w-full h-full bg-muted animate-pulse" />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })}
                      {(respostas.observacoes_gerais || inspecao.observacoes_gerais) && (
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">
                            Observações gerais
                          </dt>
                          <dd className="mt-1 text-base whitespace-pre-wrap">
                            {show(respostas.observacoes_gerais || inspecao.observacoes_gerais)}
                          </dd>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {CHECKLIST_ITEMS.map((f) => (
                          <div key={String(f.key)}>
                            <dt className="text-sm font-medium text-muted-foreground">{f.label}</dt>
                            <dd className="mt-1 text-base">
                              {traduzirChecklist(inspecao[f.key] as any)}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">
                          Avarias observadas
                        </dt>
                        <dd className="mt-1 text-base whitespace-pre-wrap">
                          {show(inspecao.avarias_observadas)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">
                          Observações gerais
                        </dt>
                        <dd className="mt-1 text-base whitespace-pre-wrap">
                          {show(inspecao.observacoes_gerais)}
                        </dd>
                      </div>

                      {inspecao.fotos_inspecao && inspecao.fotos_inspecao.length > 0 && (
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Fotos</dt>
                          <dd className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {inspecao.fotos_inspecao.map((path) => {
                              const url = fotoUrls[path];
                              return (
                                <div
                                  key={path}
                                  className="relative aspect-square border rounded overflow-hidden"
                                >
                                  {url ? (
                                    <img
                                      src={url}
                                      alt="Foto da inspeção"
                                      className="object-cover w-full h-full"
                                      onError={(e) =>
                                        ((e.target as HTMLImageElement).style.opacity = "0.3")
                                      }
                                    />
                                  ) : url === null ? (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                      Indisponível
                                    </div>
                                  ) : (
                                    <div className="w-full h-full bg-muted animate-pulse" />
                                  )}
                                </div>
                              );
                            })}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum dado de checklist disponível</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className={cn("w-full md:w-auto", isMobile ? "h-12 text-base" : "")}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoCaminhoesDetailsModal;
