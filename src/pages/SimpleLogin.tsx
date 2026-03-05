import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/AuthLayout";
import { loginUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const SimpleLogin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        console.error('❌ [SimpleLogin] Erro ao verificar sessão:', error);
      }
      setAuthChecked(true);
    };
    checkSession();
  }, [navigate]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await loginUser(data.email, data.password);

      if (result.error) {
        const msg = result.error.message;
        if (msg.includes("Invalid login credentials")) {
          setLoginError("Credenciais inválidas. Verifique seu email e senha ou use \"Esqueceu sua senha?\".");
        } else if (msg.includes("Email not confirmed")) {
          setLoginError("Seu email ainda não foi confirmado. Verifique sua caixa de entrada.");
        } else {
          setLoginError(msg);
        }
        return;
      }

      queryClient.clear();
      toast({
        title: "Login realizado com sucesso ✅",
        description: "Redirecionando para o portal...",
      });
      navigate("/", { replace: true });
    } catch (error: any) {
      setLoginError(error.message || "Erro inesperado no login");
    } finally {
      setIsLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <AuthLayout title="Verificando...">
        <div className="flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Acesso ao Sistema">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {loginError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="exemplo@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="******" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Esqueceu sua senha?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </Form>
      <div className="mt-4 text-center text-sm">
        Não tem uma conta?{" "}
        <Link to="/register" className="text-primary hover:underline flex items-center justify-center gap-1 mt-2">
          <UserPlus className="h-4 w-4" />
          Registrar-se
        </Link>
      </div>
    </AuthLayout>
  );
};

export default SimpleLogin;
