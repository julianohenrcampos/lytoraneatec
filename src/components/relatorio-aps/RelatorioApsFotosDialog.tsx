/**
 * Modal para escolher fotos disponíveis para o Relatório AP's.
 * Reaproveita as signed URLs já existentes em `fotosDisponiveis` — não faz
 * refetch, não usa getPublicUrl. Toda seleção é feita em tempo real via
 * `onSelecionar` / `onRemover`, respeitando o limite e a lógica de ordem
 * do hook `useRelatorioApsState`.
 */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, ImageIcon } from "lucide-react";
import type {
  RelatorioApsFotoDisponivel,
  RelatorioApsFotoSelecionada,
} from "@/types/relatorioAps";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fotosDisponiveis: RelatorioApsFotoDisponivel[];
  fotosSelecionadas: RelatorioApsFotoSelecionada[];
  onSelecionar: (id: string) => void;
  onRemover: (id: string) => void;
  max: number;
}

const padOrdem = (n: number): string => String(n).padStart(2, "0");

const RelatorioApsFotosDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  fotosDisponiveis,
  fotosSelecionadas,
  onSelecionar,
  onRemover,
  max,
}) => {
  const selecionadasMap = new Map(fotosSelecionadas.map((f) => [f.id, f]));
  const limiteAtingido = fotosSelecionadas.length >= max;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Escolher imagens
            </DialogTitle>
            <span className="text-xs text-muted-foreground">
              {fotosSelecionadas.length}/{max} selecionadas
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {fotosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma foto disponível nos apontamentos filtrados.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-2">
              {fotosDisponiveis.map((foto) => {
                const sel = selecionadasMap.get(foto.id);
                const isSelecionada = !!sel;
                const desabilitarSelecao = !isSelecionada && limiteAtingido;
                return (
                  <button
                    key={foto.id}
                    type="button"
                    disabled={desabilitarSelecao}
                    onClick={() =>
                      isSelecionada ? onRemover(foto.id) : onSelecionar(foto.id)
                    }
                    className={`relative border-2 rounded-md overflow-hidden bg-card text-left transition-colors ${
                      isSelecionada
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    } ${desabilitarSelecao ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={foto.signedUrl}
                        alt={foto.legendaSugerida}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelecionada && (
                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-semibold rounded px-1.5 py-0.5 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {padOrdem(sel!.ordem)}
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground truncate">
                        #{foto.sequencia} — {foto.logradouro || "Sem logradouro"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RelatorioApsFotosDialog;
