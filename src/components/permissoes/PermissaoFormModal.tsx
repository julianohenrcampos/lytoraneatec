
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type RBACPermission, type RBACPermissionFormData } from "@/services/rbac/permissionsCRUD";
import {
  MODULOS,
  MODULO_VALUES,
  isModuloValido,
  inferirModuloPorCodigo,
  inferirModuloPorRota,
} from "@/components/permissoes/modulosCatalogo";

interface PermissaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissao: RBACPermission | null;
  onSubmit: (data: RBACPermissionFormData) => void;
  isSubmitting: boolean;
}

const formSchema = z.object({
  codigo: z
    .string()
    .min(3, "Código da permissão deve ter pelo menos 3 caracteres")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Use apenas letras, números e underscore (sem espaços)"
    ),
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  modulo: z.enum(MODULO_VALUES as [string, ...string[]], {
    required_error: "Selecione o módulo da permissão.",
  }),
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
      modulo: undefined as any,
      rota: "",
    },
  });

  React.useEffect(() => {
    if (permissao) {
      const inferred =
        (isModuloValido(permissao.modulo) && permissao.modulo) ||
        inferirModuloPorCodigo(permissao.codigo) ||
        inferirModuloPorRota(permissao.rota) ||
        "outros";
      form.reset({
        codigo: permissao.codigo,
        nome: permissao.nome,
        descricao: permissao.descricao || "",
        modulo: inferred,
        rota: permissao.rota || "",
      });
    } else {
      form.reset({
        codigo: "",
        nome: "",
        descricao: "",
        modulo: undefined as any,
        rota: "",
      });
    }
  }, [permissao, form]);

  const handleFormSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("[PERMISSOES][FORM_SUBMIT]", data);
    const formData: RBACPermissionFormData = {
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao || "",
      rota: data.rota || "",
      modulo: data.modulo,
    };
    onSubmit(formData);
  };

  const handleFormInvalid = (errors: unknown) => {
    console.warn("[PERMISSOES][FORM_INVALID]", errors);
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
          <form onSubmit={form.handleSubmit(handleFormSubmit, handleFormInvalid)} className="space-y-4">
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
              name="modulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Módulo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o módulo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MODULOS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
