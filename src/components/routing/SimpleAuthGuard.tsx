import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SimpleAuthGuardProps {
  children: React.ReactNode;
}

const SimpleAuthGuard: React.FC<SimpleAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, userId, isPasswordRecovery } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const verificationAttempted = useRef(false);

  console.log('🔐 [SimpleAuthGuard] Estado atual:', { isAuthenticated, isLoading, userId, shouldRedirect });

  // Verificação adicional de sessão antes de redirecionar
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const verifySessionBeforeRedirect = async () => {
      // Se já está autenticado ou carregando, não fazer nada
      if (isAuthenticated || isLoading || isPasswordRecovery) {
        setShouldRedirect(false);
        return;
      }

      // Se já tentou verificar e não encontrou sessão, permitir redirect
      if (verificationAttempted.current) {
        setShouldRedirect(true);
        return;
      }

      // Marcar que estamos verificando
      setIsVerifying(true);
      verificationAttempted.current = true;
      
      console.log('🔍 [SimpleAuthGuard] Verificando sessão antes de redirecionar...');
      
      try {
        // Dar um tempo extra para o auth state se estabelecer
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Tentar obter sessão diretamente
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [SimpleAuthGuard] Erro ao verificar sessão:', error);
          setShouldRedirect(true);
          setIsVerifying(false);
          return;
        }

        if (session?.user) {
          console.log('✅ [SimpleAuthGuard] Sessão encontrada na verificação adicional!');
          // Tentar refresh para garantir
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          
          if (refreshedSession) {
            console.log('✅ [SimpleAuthGuard] Sessão restaurada com sucesso!');
            // Não redirecionar - a sessão foi restaurada
            setShouldRedirect(false);
            setIsVerifying(false);
            return;
          }
        }
        
        // Nenhuma sessão encontrada após verificação
        console.log('⚠️ [SimpleAuthGuard] Nenhuma sessão válida encontrada');
        setShouldRedirect(true);
      } catch (err) {
        console.error('❌ [SimpleAuthGuard] Erro na verificação:', err);
        setShouldRedirect(true);
      } finally {
        setIsVerifying(false);
      }
    };

    // Só verificar se não está autenticado e não está carregando
    if (!isAuthenticated && !isLoading && !isPasswordRecovery) {
      // Pequeno delay antes de iniciar verificação
      timeoutId = setTimeout(verifySessionBeforeRedirect, 200);
    } else {
      // Reset do estado quando autenticado
      verificationAttempted.current = false;
      setShouldRedirect(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, isLoading, isPasswordRecovery]);

  if (isLoading || isVerifying) {
    console.log('🔐 [SimpleAuthGuard] Ainda carregando/verificando auth...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  // Só redirecionar se explicitamente determinado após verificação
  if (shouldRedirect && !isAuthenticated && !userId) {
    // Se está em modo de recovery de senha, não redirecionar para login
    if (isPasswordRecovery) {
      console.log('🔄 [SimpleAuthGuard] Modo recovery - permitindo acesso');
      return <>{children}</>;
    }
    
    console.log('🔄 [SimpleAuthGuard] Usuário não autenticado - redirecionando para login');
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated && userId) {
    console.log('✅ [SimpleAuthGuard] Usuário autenticado');
    return <>{children}</>;
  }

  // Estado intermediário - ainda verificando ou aguardando
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-2">Verificando autenticação...</span>
    </div>
  );
};

export default SimpleAuthGuard;
