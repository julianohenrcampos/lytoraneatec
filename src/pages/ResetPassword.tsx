import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [stage, setStage] = useState<'waiting'|'ready'|'done'>('waiting');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStage('ready');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStage('ready');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) alert(error.message);
    else setStage('done');
  };

  if (stage === 'waiting') return (
    <AuthLayout title="Redefinir Senha">
      <p className="text-center text-gray-600">Validando link…</p>
    </AuthLayout>
  );
  
  if (stage === 'done') return (
    <AuthLayout title="Senha Atualizada">
      <div className="text-center space-y-4">
        <p className="text-green-600">Senha atualizada! Você já pode fazer login.</p>
        <a href="/login" className="inline-block text-blue-600 hover:text-blue-800">
          Ir para Login
        </a>
      </div>
    </AuthLayout>
  );

  return (
    <AuthLayout title="Definir nova senha">
      <form onSubmit={onSubmit} className="max-w-sm mx-auto space-y-3">
        <input
          type="password"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nova senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button 
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors" 
          type="submit"
        >
          Alterar senha
        </button>
      </form>
    </AuthLayout>
  );
}