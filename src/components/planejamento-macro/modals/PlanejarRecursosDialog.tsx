// Fase 6H.1 — Modal Planejar Recursos por atividade.
// Wrapper externo: Funções necessárias (atual) | Equipe designada (placeholder).

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PlanejarMaoObraForm from "./PlanejarMaoObraForm";
import PlanejarEquipeDesignadaForm from "./PlanejarEquipeDesignadaForm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atividade: {
    id: string;
    nome: string;
    planejamento_id: string;
    data_inicio?: string | null;
    data_fim?: string | null;
  } | null;
  canEdit: boolean;
  /** Fase 1C-2B — permite abrir já na aba Equipe designada (Designar equipe). */
  defaultTab?: "funcoes" | "equipe";
}

const PlanejarRecursosDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  atividade,
  canEdit,
  defaultTab = "funcoes",
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ver / ajustar recursos</DialogTitle>
          <DialogDescription>
            Recursos planejados pertencem à atividade inteira.
            {atividade && (
              <>
                {" "}
                <span className="block mt-1">
                  Atividade:{" "}
                  <span className="font-medium text-foreground">
                    {atividade.nome}
                  </span>
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {atividade && (
          <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
            <TabsList>
              <TabsTrigger value="funcoes">Funções necessárias</TabsTrigger>
              <TabsTrigger value="equipe">Equipe designada</TabsTrigger>
            </TabsList>


            <TabsContent value="funcoes" className="mt-4">
              <Tabs defaultValue="mao_obra" className="w-full">
                <TabsList>
                  <TabsTrigger value="mao_obra">Mão de obra</TabsTrigger>
                  <TabsTrigger value="equipamentos">
                    Equipamentos
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      em breve
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="materiais">
                    Materiais
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      em breve
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="mao_obra" className="mt-4">
                  <PlanejarMaoObraForm
                    planejamentoId={atividade.planejamento_id}
                    atividadeId={atividade.id}
                    canEdit={canEdit}
                  />
                </TabsContent>

                <TabsContent value="equipamentos" className="mt-4">
                  <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground text-center">
                    Lista de equipamentos planejados aparecerá aqui. Formulário de adição virá abaixo.
                    <div className="text-xs mt-1 opacity-70">Em breve.</div>
                  </div>
                </TabsContent>

                <TabsContent value="materiais" className="mt-4">
                  <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground text-center">
                    Lista de materiais planejados aparecerá aqui. Formulário de adição virá abaixo.
                    <div className="text-xs mt-1 opacity-70">Em breve.</div>
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="equipe" className="mt-4">
              <PlanejarEquipeDesignadaForm
                atividadeId={atividade.id}
                planejamentoId={atividade.planejamento_id}
                canEdit={canEdit}
                dataInicio={atividade.data_inicio ?? null}
                dataFim={atividade.data_fim ?? null}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlanejarRecursosDialog;
