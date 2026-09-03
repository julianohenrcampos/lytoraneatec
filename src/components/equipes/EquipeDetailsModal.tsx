import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Equipe } from "@/types/equipe";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCog, UserCheck, Users, Loader2 } from "lucide-react";
import { fetchEquipeMembers, type EquipeMember } from "@/services/equipe/fetchEquipeMembers";

interface EquipeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipe: Equipe | null;
}

const EquipeDetailsModal: React.FC<EquipeDetailsModalProps> = ({ isOpen, onClose, equipe }) => {
  const { data: membros = [], isLoading } = useQuery<EquipeMember[]>({
    queryKey: ["equipe-members", equipe?.id],
    queryFn: () => fetchEquipeMembers(equipe!.id),
    enabled: !!equipe?.id && isOpen,
    staleTime: 30_000,
  });

  if (!equipe) return null;

  const getMemberRole = (id: string) => {
    if (id === equipe.encarregado_id) return "encarregado";
    if (id === equipe.apontador_id) return "apontador";
    return "membro";
  };

  const getMemberIcon = (role: string) => {
    switch (role) {
      case "encarregado": return <UserCog className="h-3 w-3" />;
      case "apontador": return <UserCheck className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  const getMemberBadgeVariant = (role: string) => {
    switch (role) {
      case "encarregado": return "default" as const;
      case "apontador": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const totalMembros = membros.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Detalhes da Equipe</DialogTitle>
          <DialogDescription>Informações detalhadas sobre a equipe e seus membros.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-sm font-medium">Nome da Equipe</Label>
            <div className="rounded-md border p-2 mt-1 bg-muted/50">{equipe.nome_equipe}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Encarregado</Label>
              <div className="rounded-md border p-2 mt-1 bg-muted/50">
                {equipe.encarregado?.nome_completo || "Não definido"}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Apontador</Label>
              <div className="rounded-md border p-2 mt-1 bg-muted/50">
                {equipe.apontador?.nome_completo || "Não definido"}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">
              Membros da Equipe ({totalMembros} membro{totalMembros !== 1 ? "s" : ""})
            </Label>
            <div className="rounded-md border mt-1 bg-background min-h-[150px] max-h-[250px] overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-[150px] gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando membros...
                </div>
              ) : totalMembros > 0 ? (
                <ScrollArea className="h-[200px] w-full p-4">
                  <div className="flex flex-wrap gap-2">
                    {membros.map((membro) => {
                      const role = getMemberRole(membro.id);
                      return (
                        <Badge
                          key={membro.id}
                          variant={getMemberBadgeVariant(role)}
                          className="py-1.5 px-3 text-sm bg-secondary/50 flex items-center gap-2"
                          title={membro.funcao_nome || undefined}
                        >
                          {getMemberIcon(role)}
                          <span>
                            {membro.nome_completo || "Funcionário removido"}
                            {role !== "membro" && (
                              <span className="ml-1 text-xs opacity-75">({role})</span>
                            )}
                            {membro.funcao_nome && role === "membro" && (
                              <span className="ml-1 text-xs opacity-60">· {membro.funcao_nome}</span>
                            )}
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-[150px]">
                  <p className="text-sm text-muted-foreground">Nenhum funcionário adicionado à equipe</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Data de Criação</Label>
              <div className="rounded-md border p-2 mt-1 bg-muted/50">
                {equipe.created_at ? new Date(equipe.created_at).toLocaleDateString("pt-BR") : "N/A"}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Última Atualização</Label>
              <div className="rounded-md border p-2 mt-1 bg-muted/50">
                {equipe.updated_at ? new Date(equipe.updated_at).toLocaleDateString("pt-BR") : "N/A"}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EquipeDetailsModal;
