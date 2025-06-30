
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/AuthLayout";
import { loginUser } from "@/lib/auth";
import { confirmSpecificUserEmail } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [emailNotConfirmedError, setEmailNotConfirmedError] = useState<string | null>(null);
  const [isConfirmingEmail, setIsConfirmingEmail] = useState(false);

  // Verificar se já existe uma sessão ativa
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Se já estiver logado, redirecionar para o dashboard
        navigate("/dashboard");
      }
      setAuthChecked(true);
    };
    
    checkSession();
  }, [navigate]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleConfirmEmail = async (email: string) => {
    setIsConfirmingEmail(true);
    try {
      await confirmSpecificUserEmail();
      toast({
        title: "Email confirmado com sucesso! ✅",
        description: "Agora você pode fazer login normalmente.",
      });
      setEmailNotConfirmedError(null);
      
      // Tentar login automaticamente após confirmação
      const password = form.getValues("password");
      if (password) {
        setTimeout(() => {
          onSubmit({ email, password });
        }, 1000);
      }
    } catch (error: any) {
      console.error("Erro ao confirmar email:", error);
      toast({
        title: "Erro ao confirmar email",
        description: "Entre em contato com o suporte técnico.",
        variant: "destructive",
      });
    } finally {
      setIsConfirmingEmail(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setEmailNotConfirmedError(null);
    
    try {
      const result = await loginUser(data.email, data.password);
      
      if (result.error) {
        // Verificar se é erro de email não confirmado
        if (result.error.message.includes("Email não confirmado")) {
          setEmailNotConfirmedError(data.email);
          return;
        }
        throw new Error(result.error.message);
      }
      
      toast({
        title: "Login realizado com sucesso",
        description: "Você será redirecionado para o dashboard",
      });
      
      // Garantir que a navegação aconteça após o login ser bem sucedido
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    } catch (error: any) {
      console.error("Erro no login:", error);
      toast({
        title: "Falha no login",
        description: error.message || "Verifique suas credenciais e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <AuthLayout title="Verificando autenticação...">
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
          {emailNotConfirmedError && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <div>
                    <strong>Email não confirmado:</strong> {emailNotConfirmedError}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Clique no botão abaixo para confirmar automaticamente seu email e poder acessar o sistema.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmEmail(emailNotConfirmedError)}
                    disabled={isConfirmingEmail}
                    className="w-full"
                  >
                    {isConfirmingEmail ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                        Confirmando email...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirmar Email Automaticamente
                      </>
                    )}
                  </Button>
                </div>
              </AlertDescription>
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
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Form>
      <div className="mt-4 text-center text-sm">
        Não tem uma conta?{" "}
        <Link to="/register" className="text-primary hover:underline">
          Registrar-se
        </Link>
      </div>
    </AuthLayout>
  );
};

export default Login;
