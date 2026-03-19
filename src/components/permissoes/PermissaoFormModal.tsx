
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
import { type RBACPermission, type RBACPermissionFormData } from "@/services/rbac/permissionsCRUD";

interface PermissaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissao: RBACPermission | null;
  onSubmit: (data: RBACPermissionFormData) => void;
  isSubmitting: boolean;
}

const formSchema = z.object({
  codigo: z.string().min(3, "Código da permissão deve ter pelo menos 3 caracteres"),
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  rota: z.string().optional(),
});

const PermissaoFormModal: React.FC<PermissaoFormModalProps> = ({
  isOpen,
  onClose,
  permissao,
  onSubmit,
  isSubmitting,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      descricao: "",
      rota: "",
    },
  });

  React.useEffect(() => {
    if (permissao) {
      form.reset({
        codigo: permissao.codigo,
        nome: permissao.nome,
        descricao: permissao.descricao || "",
        rota: permissao.rota || "",
      });
    } else {
      form.reset({
        codigo: "",
        nome: "",
        descricao: "",
        rota: "",
      });
    }
  }, [permissao, form]);

  const handleFormSubmit = (data: z.infer<typeof formSchema>) => {
    const formData: RBACPermissionFormData = {
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao || "",
      rota: data.rota || "",
    };
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {permissao ? "Editar Permissão" : "Nova Permissão"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código da Permissão</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: dashboard_view" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome legível da permissão" {...field} />
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
                      placeholder="Descrição da permissão"
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
              name="rota"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rota</FormLabel>
                  <FormControl>
                    <Input placeholder="/caminho/da/rota" {...field} />
                  </FormControl>
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

export default PermissaoFormModal;
