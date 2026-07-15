import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ChevronRight,
  Compass,
  List,
  MapPinned,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMapaOperacional } from "@/hooks/useMapaOperacional";
import {
  STATUS_COLORS,
  type MapaOperacionalAtivo,
  type MapaOperacionalFiltros as Filtros,
} from "@/services/mapa-operacional/mapaOperacionalService";
import { MapaOperacionalMap } from "@/components/mapa-operacional/MapaOperacionalMap";
import { MapaOperacionalFiltros } from "@/components/mapa-operacional/MapaOperacionalFiltros";
import { MapaOperacionalPainelLateral } from "@/components/mapa-operacional/MapaOperacionalPainelLateral";
import { MapaOperacionalDetalheAtivo } from "@/components/mapa-operacional/MapaOperacionalDetalheAtivo";

const INITIAL_FILTROS: Filtros = {
  limite_desatualizado_horas: 24,
  periodo_localizacao: "TODAS",
};

export default function MapaOperacional() {
  usePageTitle("Mapa Operacional");
  const isMobile = useIsMobile();

  const [filtros, setFiltros] = useState<Filtros>(INITIAL_FILTROS);
  const [buscaLocal, setBuscaLocal] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [descartadosCount, setDescartadosCount] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useMapaOperacional(filtros);

  // Debounce da busca livre → aplica reativamente em filtros.busca
  useEffect(() => {
    const t = setTimeout(() => {
      const v = buscaLocal.trim();
      setFiltros((f) => (f.busca === (v || undefined) ? f : { ...f, busca: v || undefined }));
    }, 300);
    return () => clearTimeout(t);
  }, [buscaLocal]);

  const ativos = data?.ativos ?? [];
  const resumo = data?.resumo;
  const temAtivos = ativos.length > 0;

  const ativoSelecionado: MapaOperacionalAtivo | null = useMemo(
    () => ativos.find((a) => a.equipamento_id === selectedId) ?? null,
    [ativos, selectedId],
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setDetalheOpen(true);
  };

  const indicadores = [
    { key: "OPERACIONAL", label: "Operacionais", value: resumo?.operacionais ?? 0 },
    { key: "NAO_CONFORME", label: "Não conformes", value: resumo?.nao_conformes ?? 0 },
    { key: "PARADO", label: "Parados", value: resumo?.parados ?? 0 },
    { key: "DESATUALIZADO", label: "Desatualizados", value: resumo?.desatualizados ?? 0 },
  ] as const;

  const painelDesktopAberto = !isMobile && painelAberto && temAtivos;

  return (
    <MainLayout>
      <div className="flex h-[calc(100dvh-var(--app-header-h,64px)-2rem)] min-h-[520px] w-full min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 space-y-3">
          <MapaOperacionalFiltros
            filtros={filtros}
            onChange={setFiltros}
            onLimpar={() => {
              setFiltros(INITIAL_FILTROS);
              setBuscaLocal("");
            }}
            buscaLocal={buscaLocal}
            onBuscaLocalChange={setBuscaLocal}
          />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {indicadores.map((i) => {
              const c = STATUS_COLORS[i.key];
              return (
                <Card key={i.key} className="p-3 flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.mapboxColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{i.label}</div>
                    <div className="text-lg font-semibold leading-none">{i.value}</div>
                  </div>
                </Card>
              );
            })}
            <Card className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Localizados</div>
                <div className="text-lg font-semibold leading-none">
                  {resumo?.localizados ?? 0}
                  <span className="text-xs text-muted-foreground font-normal">
                    {" / "}
                    {resumo?.total_ativos_acessiveis ?? 0}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Atualizar agora"
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </Card>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 overflow-hidden rounded-md border">
          <div className="relative min-w-0 flex-1">
            {isLoading ? (
              <div className="absolute inset-0 p-4">
                <Skeleton className="w-full h-full" />
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <Alert variant="destructive" className="max-w-md">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Falha ao carregar o mapa</AlertTitle>
                  <AlertDescription>
                    {(error as Error).message}
                    <div className="mt-2">
                      <Button size="sm" onClick={() => refetch()}>
                        Tentar novamente
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <>
                <div className="absolute inset-0">
                  <MapaOperacionalMap
                    ativos={ativos}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onDescartados={setDescartadosCount}
                  />
                </div>
                {descartadosCount > 0 && (
                  <div className="absolute top-3 left-3 z-10 rounded bg-background/95 border px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
                    {descartadosCount} ativo(s) com coordenadas inválidas não foram exibidos.
                  </div>
                )}

                {!temAtivos && !isFetching && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                    <div className="pointer-events-auto max-w-sm bg-background/95 border rounded-lg px-4 py-3 shadow-sm text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <Compass className="h-4 w-4 text-muted-foreground" />
                        Ainda não há apontamentos com GPS.
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Registre um novo apontamento C&amp;E com a localização
                        autorizada para que o ativo apareça no monitoramento.
                      </p>
                    </div>
                  </div>
                )}

                {temAtivos && !isMobile && !painelAberto && (
                  <div className="absolute top-3 right-3 z-10">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shadow"
                      onClick={() => setPainelAberto(true)}
                    >
                      <List className="h-4 w-4 mr-2" />
                      Lista de ativos ({ativos.length})
                    </Button>
                  </div>
                )}

                {temAtivos && isMobile && (
                  <div className="absolute bottom-4 right-4 z-10">
                    <Button
                      size="sm"
                      className="shadow-lg"
                      onClick={() => setPainelAberto(true)}
                    >
                      <List className="h-4 w-4 mr-2" />
                      Ativos ({ativos.length})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {painelDesktopAberto && (
            <div className="border-l bg-background w-[360px] shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-2 h-10 border-b">
                <div className="text-xs text-muted-foreground pl-2 flex items-center gap-1">
                  <MapPinned className="h-3.5 w-3.5" /> {ativos.length} ativos
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPainelAberto(false)}
                  title="Recolher painel"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <MapaOperacionalPainelLateral
                  ativos={ativos}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              </div>
            </div>
          )}
        </div>

        {/* Mobile: lista em Sheet */}
        <Sheet
          open={isMobile && painelAberto && temAtivos}
          onOpenChange={(v) => setPainelAberto(v)}
        >
          <SheetContent side="bottom" className="h-[75dvh] p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <MapPinned className="h-4 w-4" /> {ativos.length} ativos
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => setPainelAberto(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <MapaOperacionalPainelLateral
                ativos={ativos}
                selectedId={selectedId}
                onSelect={(id) => {
                  setPainelAberto(false);
                  handleSelect(id);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        <MapaOperacionalDetalheAtivo
          ativo={ativoSelecionado}
          open={detalheOpen}
          onOpenChange={setDetalheOpen}
          onCentralizar={(id) => {
            setSelectedId(id);
            setDetalheOpen(false);
          }}
        />
      </div>
    </MainLayout>
  );
}
