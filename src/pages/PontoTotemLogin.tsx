import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Tablet } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  codigo_dispositivo: z
    .string()
    .min(2, "Código obrigatório")
    .max(50, "Código muito longo"),
  senha: z.string().min(4, "Senha obrigatória (mín. 4 caracteres)"),
});

type FormValues = z.infer<typeof schema>;

const PontoTotemLogin: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigo_dispositivo: "", senha: "" },
    mode: "onSubmit",
  });

  const handleLoginDispositivo = async (values: FormValues) => {
    console.log("[TOTEM_LOGIN] iniciando", {
      codigo: values.codigo_dispositivo,
    });
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "login-dispositivo-totem",
        {
          body: {
            codigo_dispositivo: values.codigo_dispositivo.trim().toUpperCase(),
            senha: values.senha,
          },
        },
      );

      console.log("[TOTEM_LOGIN] resposta", { data, error });

      if (error) {
        console.error("[TOTEM_LOGIN][ERRO]", error);
        toast.error("Erro ao autenticar dispositivo", {
          description: error.message || "Tente novamente.",
        });
        return;
      }

      if (!data?.success || !data?.device_secret) {
        toast.error("Credenciais inválidas", {
          description: data?.error || "Código ou senha incorretos.",
        });
        return;
      }

      localStorage.setItem("device_secret", data.device_secret);
      localStorage.setItem("device_info", JSON.stringify(data.dispositivo));

      toast.success("Dispositivo autenticado ✅", {
        description: `${data.dispositivo?.nome || "Dispositivo"} pronto para uso.`,
      });

      console.log("[TOTEM_LOGIN] sucesso, redirecionando para /ponto-totem");
      navigate("/ponto-totem", { replace: true });
    } catch (err: any) {
      console.error("[TOTEM_LOGIN][EXCEPTION]", err);
      toast.error("Erro inesperado", {
        description: err?.message || "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("[TOTEM_LOGIN] validação falhou", errors);
    toast.error("Preencha código e senha corretamente");
  };

  return (
    <AuthLayout
      title="Acesso do Dispositivo"
      description="Login do tablet/totem da obra"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleLoginDispositivo, onInvalid)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="codigo_dispositivo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código do Dispositivo</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    autoCapitalize="characters"
                    placeholder="Ex.: SEDE-01"
                    className="uppercase tracking-wider"
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
            name="senha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      placeholder="******"
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Autenticando...
              </>
            ) : (
              <>
                <Tablet className="h-4 w-4 mr-2" />
                Entrar no dispositivo
              </>
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar ao login de usuário
        </button>
      </div>
    </AuthLayout>
  );
};

export default PontoTotemLogin;
