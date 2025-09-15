
import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Verificar sessão de recuperação na inicialização
  useEffect(() => {
    const verifyResetSession = async () => {
      try {
        // Verificar se há parâmetros de hash na URL (tokens de reset)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        if (!accessToken || type !== 'recovery') {
          console.log('❌ Reset Session: Sem token de acesso ou tipo incorreto');
          setSessionError('Link de recuperação inválido ou expirado. Solicite um novo link de recuperação.');
          setIsValidSession(false);
          return;
        }

        // Verificar sessão atual
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Reset Session Error:', sessionError);
          setSessionError('Erro ao verificar sessão de recuperação. Tente novamente.');
          setIsValidSession(false);
          return;
        }

        if (!sessionData.session) {
          console.log('❌ Reset Session: Nenhuma sessão ativa');
          setSessionError('Sessão de recuperação não encontrada. O link pode ter expirado.');
          setIsValidSession(false);
          return;
        }

        // Verificar se a sessão é do tipo recovery
        if (!sessionData.session.user.aud || sessionData.session.user.aud !== 'authenticated') {
          console.log('❌ Reset Session: Tipo de sessão inválido');
          setSessionError('Sessão de recuperação inválida.');
          setIsValidSession(false);
          return;
        }

        console.log('✅ Reset Session: Válida para usuário', sessionData.session.user.email);
        setIsValidSession(true);
        setSessionError(null);

      } catch (error) {
        console.error('❌ Erro ao verificar sessão de reset:', error);
        setSessionError('Erro ao verificar link de recuperação. Tente novamente.');
        setIsValidSession(false);
      }
    };

    verifyResetSession();
  }, [location]);

  // Listener para mudanças de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth State Change em Reset:', event, session?.user?.email);
      
      if (event === 'TOKEN_REFRESHED' && session) {
        console.log('✅ Token atualizado durante reset');
        setIsValidSession(true);
      } else if (event === 'SIGNED_OUT') {
        console.log('❌ Usuário foi deslogado durante reset');
        setIsValidSession(false);
        setSessionError('Sessão expirou. Solicite um novo link de recuperação.');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!isValidSession) {
      toast({
        title: "Sessão inválida",
        description: "Não é possível redefinir a senha. Solicite um novo link de recuperação.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        console.error('❌ Erro ao atualizar senha:', error);
        
        // Tratar erros específicos
        if (error.message.includes('session') || error.message.includes('token')) {
          setSessionError('Sessão expirou. Solicite um novo link de recuperação.');
          setIsValidSession(false);
          throw new Error('Sessão de recuperação expirou. Solicite um novo link.');
        }
        
        throw error;
      }

      console.log('✅ Senha atualizada com sucesso');
      
      toast({
        title: "Senha redefinida com sucesso",
        description: "Sua senha foi atualizada. Você pode fazer login agora.",
      });
      
      // Limpar hash da URL e redirecionar
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate("/login");
      
    } catch (error: any) {
      console.error('❌ Erro no processo de redefinição:', error);
      
      toast({
        title: "Falha na redefinição",
        description: error.message || "Ocorreu um erro ao redefinir sua senha",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    navigate("/forgot-password");
  };

  // Estado de carregamento inicial
  if (isValidSession === null) {
    return (
      <AuthLayout title="Redefinir Senha">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-gray-600">Verificando link de recuperação...</p>
        </div>
      </AuthLayout>
    );
  }

  // Estado de erro de sessão
  if (!isValidSession || sessionError) {
    return (
      <AuthLayout title="Link Inválido">
        <div className="text-center py-4 space-y-4">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Link de Recuperação Inválido</h3>
            <p className="text-gray-600 mb-4">
              {sessionError || "O link de recuperação está inválido ou expirou."}
            </p>
          </div>
          
          <div className="space-y-3">
            <Button onClick={handleRequestNewLink} className="w-full">
              Solicitar Novo Link
            </Button>
            <div className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                Voltar para o login
              </Link>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Formulário de redefinição (quando sessão é válida)
  return (
    <AuthLayout title="Redefinir Senha">
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
        <p className="text-sm text-green-800">
          ✅ Link de recuperação válido. Você pode redefinir sua senha.
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova Senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
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
                <FormLabel>Confirmar Nova Senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Confirme a senha" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !isValidSession}
          >
            {isLoading ? "Redefinindo..." : "Redefinir Senha"}
          </Button>
        </form>
      </Form>
      
      <div className="mt-4 text-center text-sm space-y-2">
        <Link to="/login" className="text-primary hover:underline block">
          Voltar para o login
        </Link>
        <button 
          onClick={handleRequestNewLink}
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          Solicitar novo link de recuperação
        </button>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
