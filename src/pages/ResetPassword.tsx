// src/pages/ResetPassword.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/AuthLayout';

export default function ResetPassword() {
  const [stage, setStage] = useState<'waiting' | 'ready' | 'done'>('waiting');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // 1) Processa tokens do hash (#access_token & #refresh_token)
    const processRecoveryTokens = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) setStage('ready');
      }
    };

    processRecoveryTokens();

    // 2) Listener: PASSWORD_RECOVERY ou SIGNED_IN com sessão
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStage('ready');
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({ title: 'Erro', description: 'Digite a nova senha.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } else {
      setStage('done');
      toast({ title: 'Senha alterada!', description: 'Você será redirecionado…' });
      setTimeout(() => navigate('/login'), 1800);
    }
    setIsLoading(false);
  };

  if (stage === 'waiting') {
    return (
      <AuthLayout title="Redefinir Senha">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Validando link de recuperação…</p>
        </div>
      </AuthLayout>
    );
  }

  if (stage === 'done') {
    return (
      <AuthLayout title="Senha Atualizada">
        <div className="text-center space-y-4">
          <p className="text-green-600">✅ Senha alterada com sucesso!</p>
          <p className="text-muted-foreground">Redirecionando para o login…</p>
        </div>
      </AuthLayout>
    );
  }

  // stage === 'ready'
  return (
    <AuthLayout title="Definir nova senha">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">Nova senha</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="Mínimo 6 caracteres"
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
          {isLoading ? 'Alterando…' : 'Alterar senha'}
        </button>
      </form>
    </AuthLayout>
  );
}
