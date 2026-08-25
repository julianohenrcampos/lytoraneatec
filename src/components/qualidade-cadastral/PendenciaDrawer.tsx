import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";
import { DOMINIO_LABEL, getRegra } from "@/lib/qualidade-cadastral/regras";
import type { QcPendencia } from "@/services/qualidadeCadastralService";
import { SeveridadeBadge, TipoBadge, ScoreBar } from "./qualidadeUi";

interface Props {
  pendencia: QcPendencia | null;
  onClose: () => void;
}

/**
 * Deep-link para o cadastro oficial. Onde não existe suporte a deep-link por id,
 * navegamos para a listagem oficial com a melhor busca já suportada.
 */
function rotaCadastro(p: QcPendencia): string {
  const busca = encodeURIComponent(p.identificacao ?? "");
  switch (p.dominio) {
    case "CENTRO_CUSTO":
      return `/gestao-rh/centros-custo?busca=${busca}`;
    case "FUNCIONARIO":
      return `/gestao-rh/funcionarios?busca=${busca}`;
    case "VEICULO_EQUIPAMENTO":
      return `/gestao-maquinas/caminhoes?busca=${busca}`;
    case "FUNCAO":
      return `/gestao-rh/funcoes?busca=${busca}`;
    default:
      return "/dashboard";
  }
}

const Linha: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words">{children}</span>
  </div>
);

const PendenciaDrawer: React.FC<Props> = ({ pendencia, onClose }) => {
  const navigate = useNavigate();
  const regra = pendencia ? getRegra(pendencia.regra) : undefined;

  return (
    <Sheet open={!!pendencia} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {pendencia && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{pendencia.identificacao ?? "Registro"}</SheetTitle>
              <SheetDescription>{DOMINIO_LABEL[pendencia.dominio]}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SeveridadeBadge severidade={pendencia.severidade} />
              <TipoBadge tipo={pendencia.tipo} />
              <span className="text-xs text-muted-foreground">{pendencia.regra}</span>
            </div>

            <Separator className="my-4" />

            <div className="space-y-0.5">
              <Linha label="Registro">{pendencia.descricao ?? "—"}</Linha>
              <Linha label="Problema">{pendencia.mensagem}</Linha>
              <Linha label="Campo/regra">{pendencia.campo ?? "—"}</Linha>
              <Linha label="Por que é pendência">
                {regra?.aplicabilidade
                  ? `Regra avaliada quando: ${regra.aplicabilidade}.`
                  : "Regra aplicável ao contexto atual do registro."}
              </Linha>
              <Linha label="Empresa">{pendencia.empresa_nome ?? "—"}</Linha>
              <Linha label="Diretoria">{pendencia.diretoria_nome ?? "—"}</Linha>
              <Linha label="Departamento">{pendencia.departamento_nome ?? "—"}</Linha>
              <Linha label="Centro de custo">
                {pendencia.cc_codigo ? `${pendencia.cc_codigo} — ${pendencia.cc_nome ?? ""}` : "—"}
              </Linha>
              <Linha label="Responsável">
                {pendencia.responsavel_nome
                  ? `${pendencia.responsavel_nome}${pendencia.responsavel_papel ? ` (${pendencia.responsavel_papel})` : ""}`
                  : "Não definido"}
              </Linha>
              {pendencia.resp_secundario_nome && (
                <Linha label="Escalonamento">{pendencia.resp_secundario_nome} (ADM SEDE)</Linha>
              )}
              <Linha label="Última atualização">
                {pendencia.atualizado_em ? new Date(pendencia.atualizado_em).toLocaleString("pt-BR") : "—"}
              </Linha>
              <Linha label="Tempo sem atualização">
                {pendencia.dias_sem_atualizacao != null ? `${pendencia.dias_sem_atualizacao} dia(s)` : "—"}
              </Linha>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">Score do registro</p>
              <ScoreBar score={pendencia.score} />
            </div>

            {pendencia.tipo === "POSSIVEL_DUPLICIDADE" && (
              <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Possível duplicidade — revisar manualmente. A Central nunca exclui, une ou migra registros.
              </p>
            )}

            <Button className="mt-6 w-full" onClick={() => navigate(rotaCadastro(pendencia))}>
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir cadastro
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PendenciaDrawer;
