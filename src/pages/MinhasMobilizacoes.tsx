/**
 * CT-3D — "Minhas mobilizações": ordens do próprio motorista (mobile-first).
 *
 * A restrição de escopo é do servidor: as RPCs resolvem
 * auth.uid() → profiles.funcionario_id → bd_ct_viagens.motorista_id.
 * A página não filtra nada por conta própria e não altera dados.
 */
import React from "react";
import { AlertTriangle, MapPin, Navigation, Package, RefreshCw, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcoesViagem from "@/components/central-transporte/operacao/AcoesViagem";
import {
  useCtOrdensOperacaoTodas,
  useCtRecebimentosPendentes,
} from "@/hooks/central-transporte/useCtOperacao";
import { useCtMinhasOrdens } from "@/hooks/central-transporte/useCtMinhasOrdens";
import { linkRotaExterna } from "@/services/ctMotoristaOrdensService";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";

const dataBR = (iso: string | null): string =>
  iso ? formatBrazilianDateForDisplay(iso) : "Sem data";

/**
 * CT-3F — Acompanhamento somente leitura de uma entrega em trânsito.
 * Nenhuma ação operacional do motorista é oferecida aqui; o recebimento só nasce
 * depois que o servidor registra a chegada (status AGUARDANDO_RECEBIMENTO).
 */
const ResumoAcompanhamento: React.FC<{ ordem: CtOrdemMotorista }> = ({ ordem }) => {
  const [aberto, setAberto] = React.useState(false);
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-[11px]"
        onClick={() => setAberto((v) => !v)}
        data-testid={`ct3f-acompanhar-${ordem.id}`}
      >
        <Navigation className="h-3.5 w-3.5" /> {aberto ? "Ocultar" : "Acompanhar"}
      </Button>
      {aberto && (
        <div
          className="space-y-1 rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground"
          data-testid={`ct3f-acompanhamento-${ordem.id}`}
        >
          <p>
            <span className="font-medium text-foreground">Viagem:</span>{" "}
            {ordem.codigo || "Sem código"} · {ordem.status}
          </p>
          <p>
            <span className="font-medium text-foreground">Motorista:</span>{" "}
            {ordem.motoristaNome ?? "Não informado"}
          </p>
          <p>
            <span className="font-medium text-foreground">Recebedor:</span>{" "}
            {ordem.recebedorPrevistoNome ?? "Não informado"}
          </p>
          <p>
            <span className="font-medium text-foreground">Origem:</span>{" "}
            {ordem.origemCentroCusto ?? ordem.origemEndereco ?? "Não informada"}
          </p>
          <p>
            <span className="font-medium text-foreground">Destino:</span>{" "}
            {ordem.destinoCentroCusto ?? ordem.destinoEndereco ?? "Não informado"}
          </p>
          <p>
            <span className="font-medium text-foreground">Previsão de entrega:</span>{" "}
            {dataBR(ordem.dataPrevistaEntrega)}
          </p>
          <p>A conferência do recebimento fica disponível quando o motorista registrar a chegada.</p>
        </div>
      )}
    </div>
  );
};

const OrdemCard: React.FC<{ ordem: CtOrdemMotorista; somenteLeitura?: boolean }> = ({
  ordem,
  somenteLeitura = false,
}) => {
  const rota = linkRotaExterna(ordem);

  return (
    <Card data-testid={`ct3d-ordem-${ordem.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{ordem.codigo || "Viagem"}</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {ordem.status}
            </Badge>
            {ordem.modalidade && (
              <Badge variant="secondary" className="text-[10px]">
                {ordem.modalidade === "RODANTE" ? "Rodante" : "Transportado"}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Saída {dataBR(ordem.dataPrevistaSaida ?? ordem.dataOrdem)} · Entrega{" "}
          {dataBR(ordem.dataPrevistaEntrega)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 rounded-md border p-2">
            <p className="flex items-center gap-1 text-[11px] font-medium">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Coleta
            </p>
            <p className="font-medium">{ordem.origemCentroCusto ?? "Origem não informada"}</p>
            {ordem.origemEndereco && (
              <p className="text-muted-foreground">{ordem.origemEndereco}</p>
            )}
            {ordem.origemPontoExato && (
              <p className="text-muted-foreground">Ponto: {ordem.origemPontoExato}</p>
            )}
          </div>
          {ordem.paradas.length > 0 ? (
            <div className="space-y-2 rounded-md border p-2">
              <p className="flex items-center gap-1 text-[11px] font-medium">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Entregas ({ordem.paradas.length})
              </p>
              <ol className="space-y-1">
                {ordem.paradas.map((p) => (
                  <li key={p.id} className="rounded border p-1.5">
                    <p className="font-medium">
                      {p.ordem}ª · {p.ccNome ?? p.ccCodigo ?? "Obra não informada"}
                    </p>
                    {p.endereco && <p className="text-muted-foreground">{p.endereco}</p>}
                    {p.pontoExato && (
                      <p className="text-muted-foreground">Ponto: {p.pontoExato}</p>
                    )}
                    <p className="text-muted-foreground">
                      {p.cargas.length} ativo(s) · Recebedor:{" "}
                      {p.recebedorPrevistoNome ?? "Não informado"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="space-y-1 rounded-md border p-2">
              <p className="flex items-center gap-1 text-[11px] font-medium">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Descarga
              </p>
              <p className="font-medium">{ordem.destinoCentroCusto ?? "Destino não informado"}</p>
              {ordem.destinoEndereco && (
                <p className="text-muted-foreground">{ordem.destinoEndereco}</p>
              )}
              {ordem.destinoPontoExato && (
                <p className="text-muted-foreground">Ponto: {ordem.destinoPontoExato}</p>
              )}
              <p className="text-muted-foreground">
                Recebedor: {ordem.recebedorPrevistoNome ?? "Não informado"}
                {ordem.recebedorPrevistoTelefone ? ` · ${ordem.recebedorPrevistoTelefone}` : ""}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[11px] font-medium">
            <Package className="h-3.5 w-3.5 text-primary" /> Carga
          </p>
          {ordem.cargas.length === 0 ? (
            <p className="text-muted-foreground">Nenhum ativo vinculado.</p>
          ) : (
            <ul className="space-y-0.5">
              {ordem.cargas.map((c) => (
                <li key={c.equipamentoId} className="text-muted-foreground">
                  {[c.frota, c.numeroFrota].filter(Boolean).join("-") || "Ativo"}
                  {c.placa ? ` · ${c.placa}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        {(ordem.placaTransportador || ordem.empresaTransportadora) && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            {[ordem.placaTransportador, ordem.empresaTransportadora].filter(Boolean).join(" · ")}
          </p>
        )}

        {ordem.observacoes && <p className="text-muted-foreground">{ordem.observacoes}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {ordem.distanciaKm !== null
              ? `${ordem.distanciaKm} km estimados`
              : "Distância não calculada"}
          </span>
          {rota && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              asChild
              data-testid={`ct3d-navegar-${ordem.id}`}
            >
              <a href={rota} target="_blank" rel="noreferrer">
                <Navigation className="h-3.5 w-3.5" /> Navegar
              </a>
            </Button>
          )}
        </div>

        {somenteLeitura ? (
          <ResumoAcompanhamento ordem={ordem} />
        ) : (
          <AcoesViagem ordem={ordem} />
        )}

      </CardContent>
    </Card>
  );
};

const Secao: React.FC<{ titulo: string; ordens: CtOrdemMotorista[] }> = ({ titulo, ordens }) =>
  ordens.length === 0 ? null : (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        {titulo} <span className="text-muted-foreground">({ordens.length})</span>
      </h2>
      <div className="space-y-3">
        {ordens.map((o) => (
          <OrdemCard key={o.id} ordem={o} />
        ))}
      </div>
    </section>
  );

const MinhasMobilizacoes: React.FC = () => {
  usePageTitle("Minhas Mobilizações");
  const minhas = useCtMinhasOrdens();
  const todas = useCtOrdensOperacaoTodas();
  const recebimentos = useCtRecebimentosPendentes();

  /* A visão administrativa é decidida pelo servidor: quando a RPC nega o acesso,
     a aba simplesmente não existe para o usuário. */
  const podeVerTodas = !todas.error;

  const atualizar = () => {
    minhas.refetch();
    recebimentos.refetch();
    if (podeVerTodas) todas.refetch();
  };

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-3xl space-y-4 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Ordens de transporte, checklists de saída e recebimentos.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={atualizar}
            data-testid="ct3d-atualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>

        <Tabs defaultValue="minhas">
          <TabsList className="w-full">
            <TabsTrigger value="minhas" className="flex-1 text-xs">
              Minhas entregas
            </TabsTrigger>
            {podeVerTodas && (
              <TabsTrigger value="todas" className="flex-1 text-xs" data-testid="ct3e-aba-todas">
                Todas
              </TabsTrigger>
            )}
            <TabsTrigger value="recebimentos" className="flex-1 text-xs">
              Recebimentos
              {recebimentos.ordens.length + recebimentos.aCaminho.length > 0
                ? ` (${recebimentos.ordens.length + recebimentos.aCaminho.length})`
                : ""}
            </TabsTrigger>

          </TabsList>

          <TabsContent value="minhas" className="space-y-4 pt-3">
            {minhas.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {!minhas.isLoading && minhas.error && (
              <Alert variant="destructive" data-testid="ct3d-erro">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs">Não foi possível carregar suas ordens</AlertTitle>
                <AlertDescription className="text-xs">
                  {minhas.error instanceof Error ? minhas.error.message : "Erro inesperado."}
                </AlertDescription>
              </Alert>
            )}

            {!minhas.isLoading && !minhas.error && !minhas.vinculoFuncionario && (
              <Alert data-testid="ct3d-sem-vinculo">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs">Usuário sem vínculo de funcionário</AlertTitle>
                <AlertDescription className="text-xs">
                  Seu acesso não está vinculado a um cadastro de funcionário, por isso nenhuma ordem
                  própria pode ser exibida. Procure o RH para regularizar o vínculo.
                </AlertDescription>
              </Alert>
            )}

            {!minhas.isLoading && !minhas.error && minhas.ordens.length === 0 && (
              <Alert data-testid="ct3d-sem-ordens">
                <AlertTitle className="text-xs">Nenhuma mobilização atribuída a você</AlertTitle>
                <AlertDescription className="text-xs">
                  Quando a Central do Transporte programar uma viagem para você, ela aparecerá
                  aqui.
                </AlertDescription>
              </Alert>
            )}

            <Secao titulo="Em andamento" ordens={minhas.grupos.emAndamento} />
            <Secao titulo="Hoje" ordens={minhas.grupos.hoje} />
            <Secao titulo="Próximas" ordens={minhas.grupos.proximas} />
            <Secao titulo="Concluídas" ordens={minhas.grupos.concluidas} />
          </TabsContent>

          {podeVerTodas && (
            <TabsContent value="todas" className="space-y-3 pt-3">
              {todas.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : todas.ordens.length === 0 ? (
                <Alert>
                  <AlertTitle className="text-xs">Nenhuma viagem programada</AlertTitle>
                  <AlertDescription className="text-xs">
                    Não há viagens fora de rascunho no seu escopo.
                  </AlertDescription>
                </Alert>
              ) : (
                todas.ordens.map((o) => <OrdemCard key={o.id} ordem={o} />)
              )}
            </TabsContent>
          )}

          <TabsContent value="recebimentos" className="space-y-3 pt-3">
            {recebimentos.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : recebimentos.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {recebimentos.error instanceof Error
                    ? recebimentos.error.message
                    : "Erro inesperado."}
                </AlertDescription>
              </Alert>
            ) : recebimentos.ordens.length === 0 &&
              recebimentos.aCaminho.length === 0 &&
              recebimentos.concluidos.length === 0 ? (
              <Alert data-testid="ct3f-sem-recebimentos">
                <AlertTitle className="text-xs">Nenhum recebimento pendente</AlertTitle>
                <AlertDescription className="text-xs">
                  Viagens que chegarem ao destino sob sua responsabilidade aparecerão aqui para
                  conferência.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <section className="space-y-2" data-testid="ct3f-secao-a-caminho">
                  <h2 className="text-sm font-semibold">
                    A caminho para você{" "}
                    <span className="text-muted-foreground">({recebimentos.aCaminho.length})</span>
                  </h2>
                  {recebimentos.aCaminho.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma entrega em trânsito para você.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground" data-testid="ct3f-aviso-a-caminho">
                        {recebimentos.aCaminho.length === 1
                          ? "1 entrega está a caminho para você."
                          : `${recebimentos.aCaminho.length} entregas estão a caminho para você.`}
                      </p>
                      <div className="space-y-3">
                        {recebimentos.aCaminho.map((o) => (
                          <OrdemCard key={o.id} ordem={o} somenteLeitura />
                        ))}
                      </div>
                    </>
                  )}
                </section>

                <section className="space-y-2" data-testid="ct3f-secao-aguardando">
                  <h2 className="text-sm font-semibold">
                    Aguardando recebimento{" "}
                    <span className="text-muted-foreground">({recebimentos.ordens.length})</span>
                  </h2>
                  {recebimentos.ordens.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma viagem aguardando sua conferência.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recebimentos.ordens.map((o) => (
                        <OrdemCard key={o.id} ordem={o} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2" data-testid="ct3f-secao-recebidos">
                  <h2 className="text-sm font-semibold">
                    Recebidos{" "}
                    <span className="text-muted-foreground">
                      ({recebimentos.concluidos.length})
                    </span>
                  </h2>
                  {recebimentos.concluidos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum recebimento concluído nos últimos 30 dias.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground" data-testid="ct3f-aviso-recebidos">
                        Histórico somente leitura: recebimentos já concluídos não podem ser
                        alterados.
                      </p>
                      <div className="space-y-3">
                        {recebimentos.concluidos.map((o) => (
                          <OrdemCard key={o.id} ordem={o} somenteLeitura />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </>
            )}

          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default MinhasMobilizacoes;
