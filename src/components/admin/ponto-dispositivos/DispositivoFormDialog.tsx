import React, { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { useCentrosCustoQuery } from "@/hooks/useCentrosCustoQuery";
import {
  useSalvarDispositivo,
  useVinculosDispositivo,
} from "@/hooks/usePontoDispositivos";
import type { PontoDispositivoAdmin } from "@/services/pontoDispositivosService";

const schema = z.object({
  nome: z.string().trim().min(3, "Mínimo 3 caracteres").max(100),
  codigo_dispositivo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/, "Use 3-20 letras/números/hífen"),
  ativo: z.boolean(),
  centros_custo_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos 1 CC"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dispositivo?: PontoDispositivoAdmin | null;
}

export function DispositivoFormDialog({ open, onOpenChange, dispositivo }: Props) {
  const isEdit = !!dispositivo;
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
  const { data: ccs = [] } = useCentrosCustoQuery();
  const { data: vinculos = [], isLoading: loadingVinculos } =
    useVinculosDispositivo(isEdit ? dispositivo?.id : undefined);
  const salvar = useSalvarDispositivo();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      codigo_dispositivo: "",
      ativo: true,
      centros_custo_ids: [],
    },
  });

  const hasResetRef = useRef(false);
  const editResetForIdRef = useRef<string | null>(null);

  // Modo criação: reset único ao abrir
  useEffect(() => {
    if (!open) {
      hasResetRef.current = false;
      editResetForIdRef.current = null;
      return;
    }
    if (!dispositivo && !hasResetRef.current) {
      form.reset({
        nome: "",
        codigo_dispositivo: "",
        ativo: true,
        centros_custo_ids: [],
      });
      hasResetRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dispositivo]);

  // Modo edição: reset apenas UMA vez por dispositivo.id (após carregar vínculos)
  useEffect(() => {
    if (!open || !dispositivo || loadingVinculos) return;
    if (editResetForIdRef.current === dispositivo.id) return;
    form.reset({
      nome: dispositivo.nome ?? "",
      codigo_dispositivo: dispositivo.codigo_dispositivo ?? "",
      ativo: dispositivo.ativo ?? true,
      centros_custo_ids: (vinculos ?? [])
        .filter((v) => v.ativo)
        .map((v) => v.centro_custo_id),
    });
    editResetForIdRef.current = dispositivo.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dispositivo?.id, loadingVinculos, vinculos]);

  const ccOptions = useMemo(
    () =>
      ccs.map((c) => ({
        value: c.id,
        label: `${c.codigo_centro_custo ?? ""} — ${c.nome_centro_custo}`.trim(),
      })),
    [ccs],
  );

  const onSubmit = async (values: FormValues) => {
    console.log("[DispositivoForm] submit", values);
    try {
      await salvar.mutateAsync({
        input: {
          id: dispositivo?.id,
          nome: values.nome,
          codigo_dispositivo: values.codigo_dispositivo,
          ativo: values.ativo,
        },
        centro_custo_ids: values.centros_custo_ids,
      });
      toast.success(isEdit ? "Dispositivo atualizado" : "Dispositivo criado");
      onOpenChange(false);
    } catch (e: any) {
      console.error("[DispositivoForm] erro ao salvar", e);
      toast.error(e?.message ?? "Falha ao salvar dispositivo");
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("[DispositivoForm] formState.errors", errors);
    toast.error("Verifique os campos obrigatórios");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        ref={(node) => {
          dialogContentRef.current = node;
          setPortalContainer(node);
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Dispositivo" : "Novo Dispositivo"}
          </DialogTitle>
          <DialogDescription>
            Configure o dispositivo de obra e seus centros de custo autorizados.
          </DialogDescription>
        </DialogHeader>

        {isEdit && loadingVinculos ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Tablet Sede Recepção" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codigo_dispositivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SEDE-01"
                        className="font-mono uppercase"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="centros_custo_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centros de Custo Autorizados</FormLabel>
                    <FormControl>
                      <MultiCombobox
                        options={ccOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Selecione os centros de custo..."
                        portalContainer={portalContainer}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="m-0">Ativo</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Desativar invalida sessões na próxima revalidação.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={salvar.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvar.isPending}>
                  {salvar.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
