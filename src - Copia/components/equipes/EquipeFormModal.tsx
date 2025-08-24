
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { createEquipe, updateEquipe } from "@/services/equipe";
import { useToast } from "@/hooks/use-toast";
import { Equipe, EquipeFormData } from "@/types/equipe";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2, UserCheck, UserCog, Users } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);
  const [membrosToRemove, setMembrosToRemove] = useState<string[]>([]);
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false);
  
  const encarregadoOptions = encarregados.map(e => ({
    value: e.id,
    label: e.nome_completo
  }));

  const apontadorOptions = apontadores.map(a => ({
    value: a.id,
    label: a.nome_completo
  }));

  const regularFuncionarios = allFuncionarios.filter(f => {
    if (equipe && f.equipe_id === equipe.id) return true;
    if (f.equipe_id && (!equipe || f.equipe_id !== equipe.id)) return false;
    return true;
  });
  
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
    setMembrosToRemove([]);
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
    const previousEncarregado = form.getValues("encarregado_id");
    form.setValue("encarregado_id", value);
    
    // Remover o encarregado anterior se ele existir e adicionar o novo
    let newMembros = selectedMembros.filter(id => id !== previousEncarregado);
    if (value && !newMembros.includes(value)) {
      newMembros = [...newMembros, value];
    }
    
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
    
    if (!equipe && value) {
      const selectedEncarregado = encarregados.find(e => e.id === value);
      if (selectedEncarregado) {
        form.setValue("nome_equipe", `Equipe ${selectedEncarregado.nome_completo}`);
      }
    }
  };
  
  const handleApontadorChange = (value: string) => {
    const previousApontador = form.getValues("apontador_id");
    form.setValue("apontador_id", value);
    
    // Remover o apontador anterior se ele existir e adicionar o novo
    let newMembros = selectedMembros.filter(id => id !== previousApontador);
    if (value && !newMembros.includes(value)) {
      newMembros = [...newMembros, value];
    }
    
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
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

  const handleAddMultipleMembros = (funcionarioIds: string[]) => {
    const newFuncionarios = funcionarioIds.filter(id => !selectedMembros.includes(id));
    
    if (newFuncionarios.length === 0) {
      toast({
        title: "Nenhum funcionário novo",
        description: "Todos os funcionários selecionados já fazem parte da equipe.",
        variant: "destructive"
      });
      return;
    }
    
    const newMembros = [...selectedMembros, ...newFuncionarios];
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
    
    toast({
      title: "Funcionários adicionados",
      description: `${newFuncionarios.length} funcionário(s) adicionado(s) à equipe.`,
    });
  };
  
  const handleRemoveMembro = (id: string) => {
    const currentEncarregadoId = form.getValues("encarregado_id");
    const currentApontadorId = form.getValues("apontador_id");
    
    if (id === currentEncarregadoId) {
      toast({
        title: "Não é possível remover",
        description: "Para remover este funcionário, primeiro selecione outro encarregado.",
        variant: "destructive"
      });
      return;
    }
    
    if (id === currentApontadorId) {
      toast({
        title: "Não é possível remover",
        description: "Para remover este funcionário, primeiro selecione outro apontador.",
        variant: "destructive"
      });
      return;
    }
    
    const newMembros = selectedMembros.filter(m => m !== id);
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
  };

  const handleRemoveAll = () => {
    const currentEncarregadoId = form.getValues("encarregado_id");
    const currentApontadorId = form.getValues("apontador_id");
    
    // Manter apenas encarregado e apontador
    const essentialMembers = [currentEncarregadoId, currentApontadorId].filter(Boolean);
    setSelectedMembros(essentialMembers);
    form.setValue("equipe", essentialMembers);
    setShowRemoveAllDialog(false);
    
    toast({
      title: "Equipe limpa",
      description: "Todos os membros foram removidos, exceto encarregado e apontador.",
    });
  };

  const toggleMemberForRemoval = (id: string) => {
    const currentEncarregadoId = form.getValues("encarregado_id");
    const currentApontadorId = form.getValues("apontador_id");
    
    if (id === currentEncarregadoId || id === currentApontadorId) {
      toast({
        title: "Não é possível selecionar",
        description: "Encarregado e apontador não podem ser removidos em lote.",
        variant: "destructive"
      });
      return;
    }
    
    if (membrosToRemove.includes(id)) {
      setMembrosToRemove(prev => prev.filter(memberId => memberId !== id));
    } else {
      setMembrosToRemove(prev => [...prev, id]);
    }
  };

  const handleBulkRemove = () => {
    const newMembros = selectedMembros.filter(id => !membrosToRemove.includes(id));
    setSelectedMembros(newMembros);
    form.setValue("equipe", newMembros);
    setMembrosToRemove([]);
    setShowBulkRemoveDialog(false);
    
    toast({
      title: "Membros removidos",
      description: `${membrosToRemove.length} membro(s) removido(s) da equipe.`,
    });
  };
  
  const getFuncionarioNameById = (id: string) => {
    const funcionario = allFuncionarios.find(f => f.id === id);
    return funcionario ? funcionario.nome_completo : "Funcionário não encontrado";
  };

  const getMemberRole = (id: string) => {
    const currentEncarregadoId = form.getValues("encarregado_id");
    const currentApontadorId = form.getValues("apontador_id");
    
    if (id === currentEncarregadoId) return "encarregado";
    if (id === currentApontadorId) return "apontador";
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
      case "encarregado": return "default";
      case "apontador": return "secondary";
      default: return "outline";
    }
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
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {equipe ? "Editar Equipe" : "Cadastrar Nova Equipe"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="encarregado_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        Encarregado *
                      </FormLabel>
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
                      <FormLabel className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Apontador *
                      </FormLabel>
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
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Gerenciar Funcionários da Equipe</FormLabel>
                  <div className="flex gap-2">
                    {selectedMembros.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRemoveAllDialog(true)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Limpar Equipe
                      </Button>
                    )}
                  </div>
                </div>
                
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
                    <FormLabel className="flex items-center justify-between">
                      <span>Membros da Equipe ({selectedMembros.length})</span>
                      {membrosToRemove.length > 0 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowBulkRemoveDialog(true)}
                        >
                          Remover Selecionados ({membrosToRemove.length})
                        </Button>
                      )}
                    </FormLabel>
                    <div className="border rounded-md p-4 min-h-32">
                      {selectedMembros.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2 text-center">
                          Nenhum funcionário adicionado à equipe
                        </p>
                      ) : (
                        <ScrollArea className="h-48">
                          <div className="flex flex-wrap gap-2 p-2">
                            {selectedMembros.map((id) => {
                              const role = getMemberRole(id);
                              const isSelectedForRemoval = membrosToRemove.includes(id);
                              const canRemove = role !== "encarregado" && role !== "apontador";
                              
                              return (
                                <Badge 
                                  key={id} 
                                  variant={getMemberBadgeVariant(role)}
                                  className={`flex items-center gap-2 p-2 ${
                                    isSelectedForRemoval ? 'bg-red-100 border-red-300' : ''
                                  } ${
                                    canRemove ? 'cursor-pointer hover:bg-gray-100' : ''
                                  }`}
                                  onClick={() => canRemove && toggleMemberForRemoval(id)}
                                >
                                  {getMemberIcon(role)}
                                  <span className="text-sm">
                                    {getFuncionarioNameById(id)}
                                    {role !== "membro" && (
                                      <span className="ml-1 text-xs opacity-75">
                                        ({role})
                                      </span>
                                    )}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 p-0 hover:bg-red-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveMembro(id);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                    <span className="sr-only">Remover</span>
                                  </Button>
                                </Badge>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Clique nos membros para selecioná-los para remoção em lote. 
                      Encarregado e apontador não podem ser removidos diretamente.
                    </p>
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

      {/* Dialog para confirmar remoção de todos os membros */}
      <AlertDialog open={showRemoveAllDialog} onOpenChange={setShowRemoveAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover todos os membros da equipe? 
              O encarregado e apontador serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAll} className="bg-red-600 hover:bg-red-700">
              Sim, limpar equipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para confirmar remoção em lote */}
      <AlertDialog open={showBulkRemoveDialog} onOpenChange={setShowBulkRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membros Selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {membrosToRemove.length} membro(s) selecionado(s) da equipe?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMembrosToRemove([])}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRemove} className="bg-red-600 hover:bg-red-700">
              Sim, remover selecionados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EquipeFormModal;
