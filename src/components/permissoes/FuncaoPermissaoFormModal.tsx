
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
import type { Acao } from "@/services/rbac/actionPermissionsCRUD";
import {
  isModuloValido,
  getModuloLabel,
  inferirModuloPorCodigo,
  inferirModuloPorRota,
} from "@/components/permissoes/modulosCatalogo";

const ACOES: { key: Acao; label: string }[] = [
  { key: 'visualizar', label: 'Ver' },
  { key: 'criar', label: 'Criar' },
  { key: 'editar', label: 'Editar' },
  { key: 'excluir', label: 'Excluir' },
  { key: 'aprovar', label: 'Aprovar' },
];

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
  actions: z.array(z.object({
    permissionId: z.string(),
    acao: z.string(),
  })),
});

type FormValues = z.infer<typeof formSchema>;

const FuncaoPermissaoFormModal: React.FC<FuncaoPermissaoFormModalProps> = ({
  isOpen,
  onClose,
  funcaoPermissao,
  permissoes,
  onSubmit,
  isSubmitting,
}) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      permissions: [],
      actions: [],
    },
  });

  React.useEffect(() => {
    if (funcaoPermissao) {
      // Build actions from role data
      const actions = (funcaoPermissao.actions || []).map(a => ({
        permissionId: a.permissionId,
        acao: a.acao,
      }));
      // Derive permissions from actions (unique permission IDs)
      const permIds = Array.from(new Set(actions.map(a => a.permissionId)));
      // Also include legacy permissions that don't have actions yet
      const allPermIds = Array.from(new Set([...permIds, ...(funcaoPermissao.permissions || [])]));
      
      form.reset({
        nome: funcaoPermissao.nome,
        descricao: funcaoPermissao.descricao || "",
        permissions: allPermIds,
        actions,
      });
    } else {
      form.reset({
        nome: "",
        descricao: "",
        permissions: [],
        actions: [],
      });
    }
  }, [funcaoPermissao, form]);

  const hasAction = (permId: string, acao: Acao): boolean => {
    const actions = form.getValues('actions');
    return actions.some(a => a.permissionId === permId && a.acao === acao);
  };

  const toggleAction = (permId: string, acao: Acao) => {
    const currentActions = form.getValues('actions') as { permissionId: string; acao: string }[];
    const exists = currentActions.some(a => a.permissionId === permId && a.acao === acao);
    let newActions: { permissionId: string; acao: string }[];
    
    if (exists) {
      newActions = currentActions.filter(a => !(a.permissionId === permId && a.acao === acao));
    } else {
      newActions = [...currentActions, { permissionId: permId, acao }];
    }
    
    form.setValue('actions', newActions);
    const permIds = Array.from(new Set(newActions.map(a => a.permissionId)));
    form.setValue('permissions', permIds);
  };

  const handleFormSubmit = (data: FormValues) => {
    const formData: RBACRoleFormData = {
      nome: data.nome,
      descricao: data.descricao || "",
      permissions: data.permissions,
      actions: data.actions.map(a => ({ permissionId: a.permissionId, acao: a.acao as Acao })),
    };
    onSubmit(formData);
  };

  // Group permissions by module
  const groupedPermissions = React.useMemo(() => {
    const groups: Record<string, RBACPermission[]> = {
      'Dashboards': [],
      'Gestão de RH': [],
      'Gestão de Veículos/Equipamentos': [],
      'Requisições e Logística': [],
      'Diárias': [],
      'SSO - Segurança': [],
      'Licitações': [],
      'Administração': [],
      'Ponto Eletrônico': [],
      'Outros': [],
    };

    permissoes.forEach(permission => {
      // Prioridade: modulo → código → rota → Outros
      let moduloKey: string | undefined;
      if (isModuloValido(permission.modulo)) {
        moduloKey = permission.modulo!;
      } else {
        moduloKey =
          inferirModuloPorCodigo(permission.codigo) ||
          inferirModuloPorRota(permission.rota);
      }

      const label = (moduloKey && getModuloLabel(moduloKey)) || 'Outros';
      if (!groups[label]) groups[label] = [];
      groups[label].push(permission);
    });

    return groups;
  }, [permissoes]);

  const toggleGroupAll = (perms: RBACPermission[], select: boolean) => {
    const actions = form.getValues('actions');
    const groupIds = new Set(perms.map(p => p.id));
    
    if (select) {
      // Add all 5 actions for each permission in group
      const newActions = [...actions.filter(a => !groupIds.has(a.permissionId))];
      perms.forEach(p => {
        ACOES.forEach(ac => {
          newActions.push({ permissionId: p.id, acao: ac.key });
        });
      });
      form.setValue('actions', newActions);
      const permIds = Array.from(new Set(newActions.map(a => a.permissionId)));
      form.setValue('permissions', permIds);
    } else {
      const newActions = actions.filter(a => !groupIds.has(a.permissionId));
      form.setValue('actions', newActions);
      const permIds = Array.from(new Set(newActions.map(a => a.permissionId)));
      form.setValue('permissions', permIds);
    }
  };

  // Force re-render on actions change
  const watchedActions = form.watch('actions');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[750px]">
        <DialogHeader>
          <DialogTitle>
            {funcaoPermissao ? "Editar Função" : "Nova Função"}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Permissões de etapa (Diárias):</strong>{" "}
          <code>diarias_aprovar_gerente_adm</code>, <code>diarias_aprovar_diretor_operacional</code>,{" "}
          <code>diarias_aprovar_diretor_adm</code>. Vincule a ação <strong>Aprovar</strong> à(s)
          etapa(s) que esta função pode decidir. SuperAdm já vem com todas.
        </div>


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

            <div>
              <FormLabel>Permissões por Ação</FormLabel>
              <Card className="p-4 mt-2">
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([group, perms]) => (
                      perms.length > 0 && (
                        <div key={group} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm">{group}</h3>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => toggleGroupAll(perms, true)}
                              >
                                Todos
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => toggleGroupAll(perms, false)}
                              >
                                Nenhum
                              </Button>
                            </div>
                          </div>
                          
                          {/* Header row */}
                          <div className="grid grid-cols-[1fr_repeat(5,48px)] gap-1 ml-2 text-xs text-muted-foreground font-medium">
                            <span>Permissão</span>
                            {ACOES.map(ac => (
                              <span key={ac.key} className="text-center">{ac.label}</span>
                            ))}
                          </div>
                          
                          {/* Permission rows */}
                          <div className="space-y-1 ml-2">
                            {perms.map(permission => (
                              <div
                                key={permission.id}
                                className="grid grid-cols-[1fr_repeat(5,48px)] gap-1 items-center py-1 border-b border-border/50 last:border-0"
                              >
                                <span className="text-sm truncate" title={permission.descricao || permission.nome || permission.codigo}>
                                  {permission.descricao || permission.nome || permission.codigo}
                                </span>
                                {ACOES.map(ac => (
                                  <div key={ac.key} className="flex justify-center">
                                    <Checkbox
                                      checked={hasAction(permission.id, ac.key)}
                                      onCheckedChange={() => toggleAction(permission.id, ac.key)}
                                    />
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </div>

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
