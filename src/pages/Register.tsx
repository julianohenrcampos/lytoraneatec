import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/AuthLayout";
import { registerUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const registerSchema = z
  .object({
    nome_completo: z.string().min(3, "Nome completo deve ter pelo menos 3 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nome_completo: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const verifyEmailAuthorized = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("email")
        .eq("email", email);

      if (error) {
        console.error("Erro ao verificar email:", error);
        throw error;
      }

      return (data?.length || 0) > 0;
    } catch (error) {
      console.error("Erro ao verificar email:", error);
      return false;
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setEmailError(null);
    
    try {
      // Verificar se o email está autorizado
      const isAuthorized = await verifyEmailAuthorized(data.email);
      
      if (!isAuthorized) {
        setEmailError("Este e-mail não está autorizado para cadastro. Contate o RH.");
        toast({
          title: "Acesso não autorizado",
          description: "Este e-mail não está autorizado para cadastro. Contate o RH.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const result = await registerUser(
        data.email, 
        data.password, 
        data.nome_completo
      );

      if (result) {
        toast({
          title: "Conta criada com sucesso",
          description: "Verifique seu email para confirmar sua conta",
        });
        navigate("/login");
      }
    } catch (error: any) {
      toast({
        title: "Falha no registro",
        description: error.message || "Ocorreu um erro ao criar sua conta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Criar Conta" description="Complete o cadastro para acessar o sistema">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {emailError && (
            <Alert variant="destructive" className="mb-2">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>{emailError}</AlertDescription>
            </Alert>
          )}
          
          <FormField
            control={form.control}
            name="nome_completo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl>
                  <Input placeholder="João da Silva" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder="joao@exemplo.com" 
                    {...field} 
                    onChange={(e) => {
                      field.onChange(e);
                      // Limpar o erro de email quando o usuário alterar o campo
                      if (emailError) setEmailError(null);
                    }}
                  />
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
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar Senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="******" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Verificando..." : "Criar Conta"}
          </Button>
        </form>
      </Form>
      <div className="mt-4 text-center text-sm">
        Já tem uma conta?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Fazer login
        </Link>
      </div>
    </AuthLayout>
  );
};

export default Register;
