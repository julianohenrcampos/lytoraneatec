import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [stage, setStage] = useState<'waiting'|'ready'|'done'>('waiting');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔐 ResetPassword - Iniciando...');
    console.log('🔐 URL atual:', window.location.href);
    console.log('🔐 Hash:', window.location.hash);
    
    // Processar tokens imediatamente se presentes na URL
    const processRecoveryTokens = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      console.log('🔐 Tokens encontrados:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });
      
      if (type === 'recovery' && accessToken && refreshToken) {
        console.log('✅ Processando tokens de recovery...');
        
        try {
          // Definir sessão com os tokens da URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('❌ Erro ao definir sessão:', error);
            setStage('waiting');
          } else {
            console.log('✅ Sessão de recovery definida com sucesso');
            setStage('ready');
          }
        } catch (error) {
          console.error('❌ Erro ao processar tokens:', error);
          setStage('waiting');
        }
        return;
      }
    };
    
    processRecoveryTokens();
    
    // Configurar listener de mudanças de auth
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state mudou:', event, !!session);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        console.log('✅ Evento de recovery/signin detectado');
        setStage('ready');
      }
    });
    
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite uma nova senha",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    console.log('🔐 Tentando atualizar senha...');
    
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      console.error('❌ Erro ao atualizar senha:', error);
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      console.log('✅ Senha atualizada com sucesso');
      setStage('done');
      toast({
        title: "Senha alterada!",
        description: "Sua senha foi alterada com sucesso.",
      });
      
      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
    
    setIsLoading(false);
  };

  if (stage === 'waiting') return (
    <AuthLayout title="Redefinir Senha">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">Validando link de recuperação...</p>
        <div className="text-sm text-muted-foreground">
          <p>Se esta página não responder em alguns segundos:</p>
          <p>1. Verifique se clicou no link mais recente do email</p>
          <p>2. Tente abrir o link em uma nova aba</p>
          <p>3. Solicite um novo email de recuperação</p>
        </div>
      </div>
    </AuthLayout>
  );
  
  if (stage === 'done') return (
    <AuthLayout title="Senha Atualizada">
      <div className="text-center space-y-4">
        <p className="text-green-600">✅ Senha atualizada com sucesso!</p>
        <p className="text-muted-foreground">Redirecionando para o login...</p>
      </div>
    </AuthLayout>
  );

  return (
    <AuthLayout title="Definir nova senha">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="Digite sua nova senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <button 
          className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Alterando...' : 'Alterar senha'}
        </button>
      </form>
    </AuthLayout>
  );
}