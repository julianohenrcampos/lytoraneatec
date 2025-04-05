
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Equipe } from "@/types/equipe";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEquipeQueries } from "@/hooks/useEquipeQueries";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface EquipeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipe: Equipe | null;
}

const EquipeDetailsModal: React.FC<EquipeDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  equipe 
}) => {
  const [loading, setLoading] = useState(false);
  const [equipeDetails, setEquipeDetails] = useState<Equipe | null>(null);
  const { getEquipe } = useEquipeQueries();
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchDetails = async () => {
      if (equipe && isOpen) {
        setLoading(true);
        try {
          const details = await getEquipe(equipe.id);
          console.log("Fetched equipe details:", details);
          setEquipeDetails(details);
        } catch (error) {
          console.error("Error fetching equipe details:", error);
          toast({
            title: "Erro ao carregar detalhes",
            description: "Não foi possível carregar os membros da equipe.",
            variant: "destructive"
          });
        } finally {
          setLoading(false);
        }
      } else {
        // Reset state when modal closes
        setEquipeDetails(null);
      }
    };
    
    fetchDetails();
  }, [equipe, isOpen, getEquipe, toast]);
  
  // Return null if no equipe
  if (!equipe) return null;
  
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
            <div className="rounded-md border p-2 mt-1 bg-muted/50">
              {equipe.nome_equipe}
            </div>
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
            <Label className="text-sm font-medium">Membros da Equipe</Label>
            <div className="rounded-md border mt-1 bg-background min-h-[150px] max-h-[250px] overflow-hidden">
              {loading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-1/4" />
                </div>
              ) : equipeDetails && equipeDetails.membros && equipeDetails.membros.length > 0 ? (
                <ScrollArea className="h-[200px] w-full p-4">
                  <div className="flex flex-wrap gap-2">
                    {equipeDetails.membros.map((membro) => (
                      <Badge key={membro.id} variant="outline" className="py-1.5 px-3 text-sm bg-secondary/50">
                        {membro.nome_completo}
                      </Badge>
                    ))}
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
                {equipe.created_at ? new Date(equipe.created_at).toLocaleDateString('pt-BR') : "N/A"}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Última Atualização</Label>
              <div className="rounded-md border p-2 mt-1 bg-muted/50">
                {equipe.updated_at ? new Date(equipe.updated_at).toLocaleDateString('pt-BR') : "N/A"}
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
