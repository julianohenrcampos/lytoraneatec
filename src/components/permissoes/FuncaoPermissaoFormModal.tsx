
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { type RBACRole, type RBACRoleFormData } from "@/services/rbac/rolesCRUD";
import { type RBACPermission } from "@/services/rbac/permissionsCRUD";

interface FuncaoPermissaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcaoPermissao: RBACRole | null;
  permissoes: RBACPermission[];
  onSubmit: (data: RBACRoleFormData) => void;
  isSubmitting: boolean;
}

const formSchema = z.object({
  nome: z.string().min(3, "Nome da função deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  permissions: z.array(z.string()),
});

const FuncaoPermissaoFormModal: React.FC<FuncaoPermissaoFormModalProps> = ({
  isOpen,
  onClose,
  funcaoPermissao,
  permissoes,
  onSubmit,
  isSubmitting,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      permissions: [],
    },
  });

  React.useEffect(() => {
    if (funcaoPermissao) {
      form.reset({
        nome: funcaoPermissao.nome,
        descricao: funcaoPermissao.descricao || "",
        permissions: funcaoPermissao.permissions || [],
      });
    } else {
      form.reset({
        nome: "",
        descricao: "",
        permissions: [],
      });
    }
  }, [funcaoPermissao, form]);

  const handleFormSubmit = (data: z.infer<typeof formSchema>) => {
    const formData: RBACRoleFormData = {
      nome: data.nome,
      descricao: data.descricao || "",
      permissions: data.permissions,
    };
    onSubmit(formData);
  };

  // Group permissions by module based on their codigo
  const groupedPermissions = React.useMemo(() => {
    const groups: Record<string, RBACPermission[]> = {
      Dashboard: [],
      'Gestão de RH': [],
      'Gestão de Máquinas/Equipamentos': [],
      'Requisições e Logística': [],
      'SSO': [],
      'Diárias': [],
      'Outros': [],
    };

    permissoes.forEach(permission => {
      if (permission.codigo.startsWith('dashboard_')) {
        groups['Dashboard'].push(permission);
      } else if (permission.codigo.startsWith('gestao_rh_')) {
        groups['Gestão de RH'].push(permission);
      } else if (permission.codigo.startsWith('gestao_maquinas_')) {
        groups['Gestão de Máquinas/Equipamentos'].push(permission);
      } else if (permission.codigo.startsWith('requisicoes_')) {
        groups['Requisições e Logística'].push(permission);
      } else if (permission.codigo.startsWith('acesso_sso_')) {
        groups['SSO'].push(permission);
      } else if (permission.codigo.startsWith('diarias_')) {
        groups['Diárias'].push(permission);
      } else {
        groups['Outros'].push(permission);
      }
    });

    return groups;
  }, [permissoes]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {funcaoPermissao ? "Editar Função" : "Nova Função"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Função</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da função" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição da função"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <FormLabel>Permissões</FormLabel>
                  <Card className="p-4">
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-6">
                        {Object.entries(groupedPermissions).map(([group, perms]) => (
                          perms.length > 0 && (
                            <div key={group} className="space-y-2">
                              <h3 className="font-medium text-sm">{group}</h3>
                              <div className="space-y-2 ml-2">
                                {perms.map(permission => (
                                  <FormField
                                    key={permission.id}
                                    control={form.control}
                                    name="permissions"
                                    render={({ field }) => (
                                      <FormItem
                                        key={permission.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, permission.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== permission.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer text-sm">
                                          {permission.descricao || permission.nome || permission.codigo}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default FuncaoPermissaoFormModal;
