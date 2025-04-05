
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { createEquipe, updateEquipe, checkEquipeNameExists } from "@/services/equipeService";
import { useToast } from "@/hooks/use-toast";
import { Equipe, EquipeFormData } from "@/types/equipe";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";

interface EquipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipe?: Equipe;
  encarregados: any[];
  apontadores: any[];
  allFuncionarios: any[];
}

const formSchema = z.object({
  nome_equipe: z.string().min(1, { message: "Nome da equipe é obrigatório" }),
  encarregado_id: z.string().min(1, { message: "Encarregado é obrigatório" }),
  apontador_id: z.string().min(1, { message: "Apontador é obrigatório" }),
  equipe: z.array(z.string())
});

type FormValues = z.infer<typeof formSchema>;

const EquipeFormModal: React.FC<EquipeFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  equipe,
  encarregados,
  apontadores,
  allFuncionarios
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);
  const [selectedFuncionario, setSelectedFuncionario] = useState<string>("");
  
  const encarregadoOptions = encarregados.map(e => ({
    value: e.id,
    label: e.nome_completo
  }));

  const apontadorOptions = apontadores.map(a => ({
    value: a.id,
    label: a.nome_completo
  }));

  useEffect(() => {
    if (isOpen) {
      console.log("Modal opened, available data:");
      console.log("- Encarregados:", encarregados.length);
      console.log("- Apontadores:", apontadores.length);
      console.log("- All funcionarios:", allFuncionarios.length);
      
      if (equipe) {
        console.log("- Editing equipe:", equipe);
      } else {
        console.log("- Creating new equipe");
      }
    }
  }, [isOpen, encarregados, apontadores, allFuncionarios, equipe]);

  const encarregadoApontadorIds = [...encarregados.map(e => e.id), ...apontadores.map(a => a.id)];
  
  const regularFuncionarios = allFuncionarios.filter(f => {
    if (equipe && f.equipe_id === equipe.id) return true;
    
    if (f.equipe_id && (!equipe || f.equipe_id !== equipe.id)) return false;
    
    return true;
  });
  
  // Crie as opções para o Combobox de funcionários
  const funcionarioOptions = regularFuncionarios.map(f => ({
    value: f.id,
    label: f.nome_completo
  }));
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_equipe: "",
      encarregado_id: "",
      apontador_id: "",
      equipe: []
    }
  });

  useEffect(() => {
    if (equipe) {
      console.log("Setting form values for editing:", equipe);
      form.reset({
        nome_equipe: equipe.nome_equipe,
        encarregado_id: equipe.encarregado_id,
        apontador_id: equipe.apontador_id,
        equipe: equipe.equipe || []
      });
      setSelectedMembros(equipe.equipe || []);
    } else {
      form.reset({
        nome_equipe: "",
        encarregado_id: "",
        apontador_id: "",
        equipe: []
      });
      setSelectedMembros([]);
    }
    setSelectedFuncionario("");
  }, [equipe, form, isOpen]);
  
  const addMemberIfNotExists = (memberId: string) => {
    if (!memberId) return false;
    
    if (!selectedMembros.includes(memberId)) {
      const newMembros = [...selectedMembros, memberId];
      setSelectedMembros(newMembros);
      form.setValue("equipe", newMembros);
      return true;
    }
    return false;
  };
  
  const handleEncarregadoChange = (value: string) => {
    form.setValue("encarregado_id", value);
    
    addMemberIfNotExists(value);
    
    if (!equipe) {
      const selectedEncarregado = encarregados.find(e => e.id === value);
      if (selectedEncarregado) {
        form.setValue("nome_equipe", `Equipe ${selectedEncarregado.nome_completo}`);
      }
    }
  };
  
  const handleApontadorChange = (value: string) => {
    form.setValue("apontador_id", value);
    
    addMemberIfNotExists(value);
  };
  
  const handleAddMembro = () => {
    if (!selectedFuncionario) return;
    
    if (selectedMembros.includes(selectedFuncionario)) {
      toast({
        title: "Funcionário já adicionado",
        description: "Este funcionário já faz parte da equipe.",
        variant: "destructive"
      });
      return;
    }
    
    const newMembros = [...selectedMembros, selectedFuncionario];
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
    setSelectedFuncionario("");
  };
  
  const handleRemoveMembro = (id: string) => {
    const currentEncarregadoId = form.getValues("encarregado_id");
    const currentApontadorId = form.getValues("apontador_id");
    
    if (id === currentEncarregadoId) {
      toast({
        title: "Não é possível remover",
        description: "O encarregado atual não pode ser removido da equipe.",
        variant: "destructive"
      });
      return;
    }
    
    if (id === currentApontadorId) {
      toast({
        title: "Não é possível remover",
        description: "O apontador atual não pode ser removido da equipe.",
        variant: "destructive"
      });
      return;
    }
    
    const newMembros = selectedMembros.filter(m => m !== id);
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
  };
  
  const getFuncionarioNameById = (id: string) => {
    const funcionario = allFuncionarios.find(f => f.id === id);
    return funcionario ? funcionario.nome_completo : "Funcionário não encontrado";
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      
      const teamMembers = [...values.equipe];
      if (!teamMembers.includes(values.encarregado_id)) {
        teamMembers.push(values.encarregado_id);
      }
      if (!teamMembers.includes(values.apontador_id)) {
        teamMembers.push(values.apontador_id);
      }
      
      const formData: EquipeFormData = {
        nome_equipe: values.nome_equipe,
        encarregado_id: values.encarregado_id,
        apontador_id: values.apontador_id,
        equipe: teamMembers
      };

      console.log("Submitting form data:", formData);

      if (equipe) {
        await updateEquipe(equipe.id, formData);
        toast({
          title: "Equipe atualizada",
          description: "A equipe foi atualizada com sucesso."
        });
      } else {
        await createEquipe(formData);
        toast({
          title: "Equipe cadastrada",
          description: "A equipe foi cadastrada com sucesso."
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar equipe:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar os dados da equipe.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {equipe ? "Editar Equipe" : "Cadastrar Nova Equipe"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="encarregado_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Encarregado *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={encarregadoOptions}
                        value={field.value}
                        onChange={handleEncarregadoChange}
                        placeholder="Selecione um encarregado"
                        searchPlaceholder="Buscar encarregado..."
                        emptyText="Nenhum encarregado encontrado"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apontador_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Apontador *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={apontadorOptions}
                        value={field.value}
                        onChange={handleApontadorChange}
                        placeholder="Selecione um apontador"
                        searchPlaceholder="Buscar apontador..."
                        emptyText="Nenhum apontador encontrado"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="nome_equipe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Equipe *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da equipe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <FormLabel>Adicionar Funcionários à Equipe</FormLabel>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    options={funcionarioOptions}
                    value={selectedFuncionario}
                    onChange={setSelectedFuncionario}
                    placeholder="Selecione um funcionário"
                    searchPlaceholder="Buscar funcionário..."
                    emptyText="Nenhum funcionário disponível"
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={handleAddMembro} 
                  disabled={!selectedFuncionario}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="equipe"
              render={() => (
                <FormItem>
                  <FormLabel>Membros da Equipe</FormLabel>
                  <div className="border rounded-md p-2 min-h-20">
                    {selectedMembros.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">
                        Nenhum funcionário adicionado à equipe
                      </p>
                    ) : (
                      <ScrollArea className="h-40">
                        <div className="flex flex-wrap gap-2 p-2">
                          {selectedMembros.map((id) => (
                            <Badge key={id} variant="secondary" className="flex items-center gap-1">
                              {getFuncionarioNameById(id)}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0"
                                onClick={() => handleRemoveMembro(id)}
                              >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remover</span>
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : equipe ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EquipeFormModal;
