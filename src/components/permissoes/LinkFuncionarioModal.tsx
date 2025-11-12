import React, { useState } from "react";
import { Link2, Search, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface LinkFuncionarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string | null;
  onLink: (profileId: string, funcionarioId: string) => void;
  isSubmitting: boolean;
}

const LinkFuncionarioModal: React.FC<LinkFuncionarioModalProps> = ({
  isOpen,
  onClose,
  profileId,
  onLink,
  isSubmitting,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string | null>(null);

  // Buscar funcionários
  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ['funcionarios-para-vinculo', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('bd_funcionarios')
        .select(`
          id,
          nome_completo,
          cpf,
          funcao_id,
          departamento_id,
          bd_funcoes(nome_funcao),
          bd_departamentos(nome_departamento)
        `)
        .eq('status', 'Ativo')
        .order('nome_completo');
      
      if (searchTerm.trim()) {
        query = query.or(`nome_completo.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) {
        console.error('❌ Erro ao buscar funcionários:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: isOpen
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileId && selectedFuncionarioId) {
      onLink(profileId, selectedFuncionarioId);
    }
  };

  const selectedFuncionario = funcionarios?.find(f => f.id === selectedFuncionarioId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular Funcionário
          </DialogTitle>
          <DialogDescription>
            Vincule este usuário a um funcionário para aplicar o filtro departamental
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              ⚠️ Ao vincular a um funcionário com departamento, o usuário <strong>só verá dados daquele departamento</strong>.
              <br />
              Funcionários sem departamento mantêm <strong>acesso global</strong>.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Buscar Funcionário</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome ou CPF do funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Funcionários Disponíveis ({funcionarios?.length || 0})</Label>
            <ScrollArea className="h-[300px] border rounded-lg">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando funcionários...
                </div>
              ) : funcionarios && funcionarios.length > 0 ? (
                <div className="p-2 space-y-1">
                  {funcionarios.map((funcionario) => (
                    <button
                      key={funcionario.id}
                      type="button"
                      onClick={() => setSelectedFuncionarioId(funcionario.id)}
                      className={`w-full p-3 text-left rounded-lg border transition-colors ${
                        selectedFuncionarioId === funcionario.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{funcionario.nome_completo}</p>
                          <div className="flex gap-2 mt-1">
                            {funcionario.bd_funcoes?.nome_funcao && (
                              <Badge variant="outline" className="text-xs">
                                {funcionario.bd_funcoes.nome_funcao}
                              </Badge>
                            )}
                            {funcionario.bd_departamentos?.nome_departamento ? (
                              <Badge className="text-xs">
                                {funcionario.bd_departamentos.nome_departamento}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Sem Departamento
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum funcionário encontrado
                </div>
              )}
            </ScrollArea>
          </div>

          {selectedFuncionario && (
            <Alert>
              <AlertDescription>
                <strong>✅ Selecionado:</strong> {selectedFuncionario.nome_completo}
                <br />
                <strong>Departamento:</strong> {selectedFuncionario.bd_departamentos?.nome_departamento || 'Nenhum (Acesso Global)'}
                <br />
                {selectedFuncionario.bd_departamentos?.nome_departamento ? (
                  <span className="text-orange-600">
                    ⚠️ Este usuário verá apenas dados do departamento {selectedFuncionario.bd_departamentos.nome_departamento}
                  </span>
                ) : (
                  <span className="text-green-600">
                    ✅ Este usuário terá acesso global (sem restrição departamental)
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedFuncionarioId || isSubmitting}>
              {isSubmitting ? "Vinculando..." : "Vincular Funcionário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LinkFuncionarioModal;
